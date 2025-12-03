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
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/log"

	pipelinev1 "github.com/yaacov/jobrunner/api/v1"
)

// updateStepStatuses fetches and updates the status of all running jobs
func (r *PipelineReconciler) updateStepStatuses(ctx context.Context, pipeline *pipelinev1.Pipeline) error {
	logger := log.FromContext(ctx)

	changed := false
	checkedJobs := 0

	for i := range pipeline.Status.Steps {
		stepStatus := &pipeline.Status.Steps[i]
		if stepStatus.JobName == "" {
			continue
		}

		checkedJobs++

		// Fetch the job
		job := &batchv1.Job{}
		if err := r.Get(ctx, types.NamespacedName{
			Name:      stepStatus.JobName,
			Namespace: pipeline.Namespace,
		}, job); err != nil {
			if apierrors.IsNotFound(err) {
				logger.Info("Job not found, may have been deleted",
					"job", stepStatus.JobName,
					"step", stepStatus.Name)
				continue
			}
			logger.Error(err, "Failed to fetch job",
				"job", stepStatus.JobName,
				"step", stepStatus.Name)
			return err
		}

		// Update status from job
		oldPhase := stepStatus.Phase
		stepStatus.JobStatus = &job.Status

		// Determine phase from job conditions
		newPhase := r.determineStepPhase(job, stepStatus.Phase)

		if oldPhase != newPhase {
			stepStatus.Phase = newPhase
			logger.Info("Step phase changed",
				"step", stepStatus.Name,
				"job", stepStatus.JobName,
				"oldPhase", oldPhase,
				"newPhase", newPhase,
				"active", job.Status.Active,
				"succeeded", job.Status.Succeeded,
				"failed", job.Status.Failed)
			changed = true
		} else {
			logger.V(1).Info("Step status checked",
				"step", stepStatus.Name,
				"phase", stepStatus.Phase,
				"active", job.Status.Active)
		}
	}

	if changed {
		logger.Info("Updating pipeline status", "changedSteps", true)
		if err := r.Status().Update(ctx, pipeline); err != nil {
			logger.Error(err, "Failed to update pipeline status")
			return err
		}
	} else {
		logger.V(1).Info("No step status changes detected", "checkedJobs", checkedJobs)
	}

	return nil
}

// determineStepPhase determines the step phase based on job status
func (r *PipelineReconciler) determineStepPhase(job *batchv1.Job, currentPhase pipelinev1.StepPhase) pipelinev1.StepPhase {
	// Check job conditions for terminal states
	for _, condition := range job.Status.Conditions {
		if condition.Type == batchv1.JobComplete && condition.Status == corev1.ConditionTrue {
			log.Log.V(1).Info("Job completed successfully",
				"job", job.Name,
				"completionTime", condition.LastTransitionTime)
			return pipelinev1.StepPhaseSucceeded
		} else if condition.Type == batchv1.JobFailed && condition.Status == corev1.ConditionTrue {
			log.Log.Info("Job failed",
				"job", job.Name,
				"reason", condition.Reason,
				"message", condition.Message,
				"failedPods", job.Status.Failed)
			return pipelinev1.StepPhaseFailed
		} else if condition.Type == batchv1.JobSuspended && condition.Status == corev1.ConditionTrue {
			log.Log.Info("Job suspended",
				"job", job.Name,
				"reason", condition.Reason,
				"message", condition.Message)
			return pipelinev1.StepPhaseSuspended
		}
	}

	// Check if job is actively running
	if job.Status.Active > 0 {
		if currentPhase != pipelinev1.StepPhaseRunning {
			log.Log.V(1).Info("Job is now running",
				"job", job.Name,
				"activePods", job.Status.Active)
		}
		return pipelinev1.StepPhaseRunning
	}

	// No change detected, keep current phase
	return currentPhase
}

// updateConditions updates the pipeline status conditions based on current phase
func (r *PipelineReconciler) updateConditions(pipeline *pipelinev1.Pipeline, state pipelineState) {
	now := metav1.Now()

	var condition metav1.Condition

	switch pipeline.Status.Phase {
	case pipelinev1.PipelinePhasePending:
		condition = metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionFalse,
			Reason:             "Pending",
			Message:            "Pipeline is pending",
			LastTransitionTime: now,
		}

	case pipelinev1.PipelinePhaseRunning:
		// Count running/pending/completed steps for message
		runningCount := 0
		completedCount := 0
		for _, step := range pipeline.Status.Steps {
			switch step.Phase {
			case pipelinev1.StepPhaseRunning:
				runningCount++
			case pipelinev1.StepPhaseSucceeded, pipelinev1.StepPhaseSkipped:
				completedCount++
			}
		}

		condition = metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionFalse,
			Reason:             "Running",
			Message:            fmt.Sprintf("Pipeline is running (%d/%d steps completed, %d running)", completedCount, len(pipeline.Status.Steps), runningCount),
			LastTransitionTime: now,
		}

	case pipelinev1.PipelinePhaseSuspended:
		message := "Pipeline is suspended"
		if len(state.suspendedSteps) > 0 {
			message = fmt.Sprintf("Pipeline is suspended (suspended steps: %v)", state.suspendedSteps)
		}

		condition = metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionFalse,
			Reason:             "Suspended",
			Message:            message,
			LastTransitionTime: now,
		}

	case pipelinev1.PipelinePhaseSucceeded:
		duration := ""
		if pipeline.Status.StartTime != nil && pipeline.Status.CompletionTime != nil {
			d := pipeline.Status.CompletionTime.Sub(pipeline.Status.StartTime.Time)
			duration = fmt.Sprintf(" in %s", d.Round(time.Second))
		}

		condition = metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionTrue,
			Reason:             "Succeeded",
			Message:            fmt.Sprintf("Pipeline completed successfully%s", duration),
			LastTransitionTime: now,
		}

	case pipelinev1.PipelinePhaseFailed:
		// Find which steps failed
		failedSteps := []string{}
		for _, step := range pipeline.Status.Steps {
			if step.Phase == pipelinev1.StepPhaseFailed {
				failedSteps = append(failedSteps, step.Name)
			}
		}

		message := "Pipeline failed"
		if len(failedSteps) > 0 {
			message = fmt.Sprintf("Pipeline failed (failed steps: %v)", failedSteps)
		}

		condition = metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionFalse,
			Reason:             "Failed",
			Message:            message,
			LastTransitionTime: now,
		}
	}

	// Check if condition actually changed before logging
	existingCondition := meta.FindStatusCondition(pipeline.Status.Conditions, "Ready")
	if existingCondition == nil || existingCondition.Status != condition.Status || existingCondition.Reason != condition.Reason {
		log.Log.Info("Updating pipeline condition",
			"pipeline", pipeline.Name,
			"condition", "Ready",
			"status", condition.Status,
			"reason", condition.Reason,
			"message", condition.Message)
	}

	meta.SetStatusCondition(&pipeline.Status.Conditions, condition)
}
