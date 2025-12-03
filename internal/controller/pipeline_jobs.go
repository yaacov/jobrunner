/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package controller

import (
	"context"
	"fmt"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"

	pipelinev1 "github.com/yaacov/jobrunner/api/v1"
)

// startReadySteps attempts to start all steps that are ready to run
func (r *PipelineReconciler) startReadySteps(ctx context.Context, pipeline *pipelinev1.Pipeline) error {
	logger := log.FromContext(ctx)

	for i := range pipeline.Spec.Steps {
		step := &pipeline.Spec.Steps[i]
		stepStatus := r.getStepStatus(pipeline, step.Name)

		// Skip if already started
		if stepStatus.Phase != pipelinev1.StepPhasePending {
			continue
		}

		// Check if this step should be skipped based on conditions
		if r.shouldSkipStep(pipeline, step) {
			logger.Info("Skipping step due to unmet conditions", "step", step.Name)
			stepStatus.Phase = pipelinev1.StepPhaseSkipped
			if err := r.Status().Update(ctx, pipeline); err != nil {
				return err
			}
			continue
		}

		// Check if dependencies are satisfied
		ready, shouldSkip := r.areDependenciesSatisfied(pipeline, step)
		if shouldSkip {
			logger.Info("Skipping step due to dependency conditions", "step", step.Name)
			stepStatus.Phase = pipelinev1.StepPhaseSkipped
			if err := r.Status().Update(ctx, pipeline); err != nil {
				return err
			}
			continue
		}
		if !ready {
			continue
		}

		// Create the job for this step
		if err := r.createJobForStep(ctx, pipeline, step, stepStatus); err != nil {
			logger.Error(err, "unable to create job for step", "step", step.Name)
			return err
		}

		logger.Info("Started step", "step", step.Name, "job", stepStatus.JobName)

		// Update status to Running
		stepStatus.Phase = pipelinev1.StepPhaseRunning
		if err := r.Status().Update(ctx, pipeline); err != nil {
			return err
		}
	}

	return nil
}

// createJobForStep creates a Kubernetes Job for a pipeline step
func (r *PipelineReconciler) createJobForStep(ctx context.Context, pipeline *pipelinev1.Pipeline, step *pipelinev1.PipelineStep, stepStatus *pipelinev1.StepStatus) error {
	logger := log.FromContext(ctx)
	jobName := fmt.Sprintf("%s-%s", pipeline.Name, step.Name)
	stepStatus.JobName = jobName

	logger.Info("Creating job for step",
		"step", step.Name,
		"job", jobName,
		"pipeline", pipeline.Name)

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: pipeline.Namespace,
			Labels: map[string]string{
				"pipeline.yaacov.io/pipeline": pipeline.Name,
				"pipeline.yaacov.io/step":     step.Name,
			},
		},
		Spec: step.JobSpec,
	}

	// Set backoffLimit to 0 if not specified (fail fast for pipeline steps)
	if job.Spec.BackoffLimit == nil {
		backoffLimit := int32(0)
		job.Spec.BackoffLimit = &backoffLimit
		logger.V(1).Info("Setting default backoffLimit to 0 for pipeline step", "step", step.Name)
	}

	// Apply pod template defaults
	if pipeline.Spec.PodTemplate != nil {
		logger.V(1).Info("Applying pod template defaults", "step", step.Name)
	}
	r.applyPodTemplateDefaults(pipeline, job)

	// Apply shared volume if configured
	if pipeline.Spec.SharedVolume != nil {
		logger.V(1).Info("Applying shared volume configuration",
			"step", step.Name,
			"volume", pipeline.Spec.SharedVolume.GetName(),
			"mountPath", pipeline.Spec.SharedVolume.GetMountPath())
	}
	r.applySharedVolume(pipeline, step, job)

	// Set controller reference
	if err := controllerutil.SetControllerReference(pipeline, job, r.Scheme); err != nil {
		logger.Error(err, "Failed to set controller reference", "job", jobName)
		return err
	}

	// Create the job
	if err := r.Create(ctx, job); err != nil {
		logger.Error(err, "Failed to create job", "job", jobName, "step", step.Name)
		return err
	}

	logger.Info("Job created successfully",
		"job", jobName,
		"step", step.Name,
		"namespace", pipeline.Namespace)
	return nil
}

// applyPodTemplateDefaults applies pipeline-level pod template defaults to a job
func (r *PipelineReconciler) applyPodTemplateDefaults(pipeline *pipelinev1.Pipeline, job *batchv1.Job) {
	if pipeline.Spec.PodTemplate == nil {
		// Still apply service account even without pod template
		r.applyServiceAccountName(pipeline, &job.Spec.Template.Spec)
		return
	}

	podTemplate := pipeline.Spec.PodTemplate
	podSpec := &job.Spec.Template.Spec

	r.applyPodSpecDefaults(podTemplate, podSpec)
	r.applyPodMetadataDefaults(podTemplate, job)
	r.applyContainerDefaults(podTemplate, podSpec)
	r.applyServiceAccountName(pipeline, podSpec)
}

// applyPodSpecDefaults applies pod-level scheduling and configuration defaults
func (r *PipelineReconciler) applyPodSpecDefaults(podTemplate *pipelinev1.PodTemplateDefaults, podSpec *corev1.PodSpec) {
	// Apply node selector
	if len(podTemplate.NodeSelector) > 0 {
		if podSpec.NodeSelector == nil {
			podSpec.NodeSelector = make(map[string]string)
		}
		for k, v := range podTemplate.NodeSelector {
			if _, exists := podSpec.NodeSelector[k]; !exists {
				podSpec.NodeSelector[k] = v
			}
		}
	}

	// Apply affinity
	if podTemplate.Affinity != nil && podSpec.Affinity == nil {
		podSpec.Affinity = podTemplate.Affinity
	}

	// Apply tolerations
	if len(podTemplate.Tolerations) > 0 {
		podSpec.Tolerations = append(podSpec.Tolerations, podTemplate.Tolerations...)
	}

	// Apply security context
	if podTemplate.SecurityContext != nil && podSpec.SecurityContext == nil {
		podSpec.SecurityContext = podTemplate.SecurityContext
	}

	// Apply image pull secrets
	if len(podTemplate.ImagePullSecrets) > 0 {
		podSpec.ImagePullSecrets = append(podSpec.ImagePullSecrets, podTemplate.ImagePullSecrets...)
	}

	// Apply priority class name
	if podTemplate.PriorityClassName != "" && podSpec.PriorityClassName == "" {
		podSpec.PriorityClassName = podTemplate.PriorityClassName
	}

	// Apply runtime class name
	if podTemplate.RuntimeClassName != nil && podSpec.RuntimeClassName == nil {
		podSpec.RuntimeClassName = podTemplate.RuntimeClassName
	}

	// Apply scheduler name
	if podTemplate.SchedulerName != "" && podSpec.SchedulerName == "" {
		podSpec.SchedulerName = podTemplate.SchedulerName
	}
}

// applyPodMetadataDefaults applies labels and annotations to the pod template
func (r *PipelineReconciler) applyPodMetadataDefaults(podTemplate *pipelinev1.PodTemplateDefaults, job *batchv1.Job) {
	// Apply labels to pod template
	if len(podTemplate.Labels) > 0 {
		if job.Spec.Template.Labels == nil {
			job.Spec.Template.Labels = make(map[string]string)
		}
		for k, v := range podTemplate.Labels {
			if _, exists := job.Spec.Template.Labels[k]; !exists {
				job.Spec.Template.Labels[k] = v
			}
		}
	}

	// Apply annotations to pod template
	if len(podTemplate.Annotations) > 0 {
		if job.Spec.Template.Annotations == nil {
			job.Spec.Template.Annotations = make(map[string]string)
		}
		for k, v := range podTemplate.Annotations {
			if _, exists := job.Spec.Template.Annotations[k]; !exists {
				job.Spec.Template.Annotations[k] = v
			}
		}
	}
}

// applyContainerDefaults applies defaults to all containers in the pod spec
func (r *PipelineReconciler) applyContainerDefaults(podTemplate *pipelinev1.PodTemplateDefaults, podSpec *corev1.PodSpec) {
	// Apply environment variables to all containers
	if len(podTemplate.Env) > 0 || len(podTemplate.EnvFrom) > 0 {
		for i := range podSpec.Containers {
			podSpec.Containers[i].Env = append(podSpec.Containers[i].Env, podTemplate.Env...)
			podSpec.Containers[i].EnvFrom = append(podSpec.Containers[i].EnvFrom, podTemplate.EnvFrom...)
		}
	}

	// Apply default resources to containers without resources
	if podTemplate.DefaultResources != nil {
		for i := range podSpec.Containers {
			if podSpec.Containers[i].Resources.Limits == nil && podSpec.Containers[i].Resources.Requests == nil {
				podSpec.Containers[i].Resources = *podTemplate.DefaultResources
			}
		}
	}

	// Apply default image to containers without an image
	if podTemplate.Image != "" {
		for i := range podSpec.Containers {
			if podSpec.Containers[i].Image == "" {
				podSpec.Containers[i].Image = podTemplate.Image
			}
		}
	}
}

// applyServiceAccountName applies the service account name from the pipeline spec
func (r *PipelineReconciler) applyServiceAccountName(pipeline *pipelinev1.Pipeline, podSpec *corev1.PodSpec) {
	if pipeline.Spec.ServiceAccountName != "" && podSpec.ServiceAccountName == "" {
		podSpec.ServiceAccountName = pipeline.Spec.ServiceAccountName
	}
}

// applySharedVolume configures shared volume mounting for a job
func (r *PipelineReconciler) applySharedVolume(pipeline *pipelinev1.Pipeline, step *pipelinev1.PipelineStep, job *batchv1.Job) {
	if pipeline.Spec.SharedVolume == nil {
		return
	}

	sharedVol := pipeline.Spec.SharedVolume
	podSpec := &job.Spec.Template.Spec

	// Add volume
	volume := corev1.Volume{
		Name:         sharedVol.GetName(),
		VolumeSource: sharedVol.VolumeSource,
	}
	podSpec.Volumes = append(podSpec.Volumes, volume)

	// Mount volume in all containers
	volumeMount := corev1.VolumeMount{
		Name:      sharedVol.GetName(),
		MountPath: sharedVol.GetMountPath(),
	}

	containerCount := len(podSpec.Containers)
	for i := range podSpec.Containers {
		podSpec.Containers[i].VolumeMounts = append(podSpec.Containers[i].VolumeMounts, volumeMount)
	}

	log.Log.V(1).Info("Mounted shared volume in containers",
		"step", step.Name,
		"containerCount", containerCount,
		"volumeName", sharedVol.GetName())
}
