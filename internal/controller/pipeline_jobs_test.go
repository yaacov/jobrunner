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
	"testing"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pipelinev1 "github.com/yaacov/jobrunner/api/v1"
)

func TestApplyPodSpecDefaults(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name        string
		podTemplate *pipelinev1.PodTemplateDefaults
		podSpec     *corev1.PodSpec
		wantCheck   func(t *testing.T, podSpec *corev1.PodSpec)
	}{
		{
			name: "applies node selector when not set",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				NodeSelector: map[string]string{"disktype": "ssd"},
			},
			podSpec: &corev1.PodSpec{},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.NodeSelector["disktype"] != "ssd" {
					t.Errorf("expected disktype=ssd, got %v", podSpec.NodeSelector)
				}
			},
		},
		{
			name: "does not override existing node selector keys",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				NodeSelector: map[string]string{"disktype": "ssd", "region": "us-west"},
			},
			podSpec: &corev1.PodSpec{
				NodeSelector: map[string]string{"disktype": "hdd"},
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.NodeSelector["disktype"] != "hdd" {
					t.Errorf("expected disktype=hdd (not overridden), got %v", podSpec.NodeSelector["disktype"])
				}
				if podSpec.NodeSelector["region"] != "us-west" {
					t.Errorf("expected region=us-west to be added, got %v", podSpec.NodeSelector["region"])
				}
			},
		},
		{
			name: "applies affinity when not set",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Affinity: &corev1.Affinity{
					NodeAffinity: &corev1.NodeAffinity{
						RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
							NodeSelectorTerms: []corev1.NodeSelectorTerm{
								{
									MatchExpressions: []corev1.NodeSelectorRequirement{
										{Key: "test", Operator: corev1.NodeSelectorOpIn, Values: []string{"value"}},
									},
								},
							},
						},
					},
				},
			},
			podSpec: &corev1.PodSpec{},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.Affinity == nil {
					t.Error("expected affinity to be set")
				}
			},
		},
		{
			name: "does not override existing affinity",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Affinity: &corev1.Affinity{
					NodeAffinity: &corev1.NodeAffinity{},
				},
			},
			podSpec: &corev1.PodSpec{
				Affinity: &corev1.Affinity{
					PodAffinity: &corev1.PodAffinity{},
				},
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.Affinity.PodAffinity == nil {
					t.Error("expected existing affinity to be preserved")
				}
			},
		},
		{
			name: "appends tolerations",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Tolerations: []corev1.Toleration{
					{Key: "key1", Operator: corev1.TolerationOpExists},
				},
			},
			podSpec: &corev1.PodSpec{
				Tolerations: []corev1.Toleration{
					{Key: "existing", Operator: corev1.TolerationOpExists},
				},
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if len(podSpec.Tolerations) != 2 {
					t.Errorf("expected 2 tolerations, got %d", len(podSpec.Tolerations))
				}
			},
		},
		{
			name: "applies security context when not set",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				SecurityContext: &corev1.PodSecurityContext{
					RunAsNonRoot: boolPtr(true),
				},
			},
			podSpec: &corev1.PodSpec{},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.SecurityContext == nil || podSpec.SecurityContext.RunAsNonRoot == nil || !*podSpec.SecurityContext.RunAsNonRoot {
					t.Error("expected security context with RunAsNonRoot=true")
				}
			},
		},
		{
			name: "appends image pull secrets",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				ImagePullSecrets: []corev1.LocalObjectReference{
					{Name: "secret1"},
				},
			},
			podSpec: &corev1.PodSpec{
				ImagePullSecrets: []corev1.LocalObjectReference{
					{Name: "existing-secret"},
				},
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if len(podSpec.ImagePullSecrets) != 2 {
					t.Errorf("expected 2 image pull secrets, got %d", len(podSpec.ImagePullSecrets))
				}
			},
		},
		{
			name: "applies priority class name when not set",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				PriorityClassName: "high-priority",
			},
			podSpec: &corev1.PodSpec{},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.PriorityClassName != "high-priority" {
					t.Errorf("expected priority class name 'high-priority', got %s", podSpec.PriorityClassName)
				}
			},
		},
		{
			name: "does not override existing priority class name",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				PriorityClassName: "high-priority",
			},
			podSpec: &corev1.PodSpec{
				PriorityClassName: "low-priority",
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.PriorityClassName != "low-priority" {
					t.Errorf("expected priority class name 'low-priority' (not overridden), got %s", podSpec.PriorityClassName)
				}
			},
		},
		{
			name: "applies runtime class name when not set",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				RuntimeClassName: stringPtr("gvisor"),
			},
			podSpec: &corev1.PodSpec{},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.RuntimeClassName == nil || *podSpec.RuntimeClassName != "gvisor" {
					t.Error("expected runtime class name 'gvisor'")
				}
			},
		},
		{
			name: "applies scheduler name when not set",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				SchedulerName: "custom-scheduler",
			},
			podSpec: &corev1.PodSpec{},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.SchedulerName != "custom-scheduler" {
					t.Errorf("expected scheduler name 'custom-scheduler', got %s", podSpec.SchedulerName)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r.applyPodSpecDefaults(tt.podTemplate, tt.podSpec)
			tt.wantCheck(t, tt.podSpec)
		})
	}
}

func TestApplyPodMetadataDefaults(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name        string
		podTemplate *pipelinev1.PodTemplateDefaults
		job         *batchv1.Job
		wantCheck   func(t *testing.T, job *batchv1.Job)
	}{
		{
			name: "applies labels when not set",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Labels: map[string]string{"app": "test", "env": "prod"},
			},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if job.Spec.Template.Labels["app"] != "test" {
					t.Errorf("expected app=test, got %v", job.Spec.Template.Labels)
				}
				if job.Spec.Template.Labels["env"] != "prod" {
					t.Errorf("expected env=prod, got %v", job.Spec.Template.Labels)
				}
			},
		},
		{
			name: "does not override existing labels",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Labels: map[string]string{"app": "default", "env": "prod"},
			},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						ObjectMeta: metav1.ObjectMeta{
							Labels: map[string]string{"app": "custom"},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if job.Spec.Template.Labels["app"] != "custom" {
					t.Errorf("expected app=custom (not overridden), got %v", job.Spec.Template.Labels["app"])
				}
				if job.Spec.Template.Labels["env"] != "prod" {
					t.Errorf("expected env=prod to be added, got %v", job.Spec.Template.Labels["env"])
				}
			},
		},
		{
			name: "applies annotations when not set",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Annotations: map[string]string{"prometheus.io/scrape": "true"},
			},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if job.Spec.Template.Annotations["prometheus.io/scrape"] != "true" {
					t.Errorf("expected annotation to be set, got %v", job.Spec.Template.Annotations)
				}
			},
		},
		{
			name: "does not override existing annotations",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Annotations: map[string]string{"key": "default"},
			},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						ObjectMeta: metav1.ObjectMeta{
							Annotations: map[string]string{"key": "custom"},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if job.Spec.Template.Annotations["key"] != "custom" {
					t.Errorf("expected key=custom (not overridden), got %v", job.Spec.Template.Annotations["key"])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r.applyPodMetadataDefaults(tt.podTemplate, tt.job)
			tt.wantCheck(t, tt.job)
		})
	}
}

func TestApplyContainerDefaults(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name        string
		podTemplate *pipelinev1.PodTemplateDefaults
		podSpec     *corev1.PodSpec
		wantCheck   func(t *testing.T, podSpec *corev1.PodSpec)
	}{
		{
			name: "applies env variables to all containers",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Env: []corev1.EnvVar{
					{Name: "LOG_LEVEL", Value: "debug"},
				},
			},
			podSpec: &corev1.PodSpec{
				Containers: []corev1.Container{
					{Name: "container1"},
					{Name: "container2"},
				},
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				for i, c := range podSpec.Containers {
					if len(c.Env) != 1 || c.Env[0].Name != "LOG_LEVEL" {
						t.Errorf("container %d: expected LOG_LEVEL env var, got %v", i, c.Env)
					}
				}
			},
		},
		{
			name: "appends env variables to existing ones",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Env: []corev1.EnvVar{
					{Name: "NEW_VAR", Value: "value"},
				},
			},
			podSpec: &corev1.PodSpec{
				Containers: []corev1.Container{
					{
						Name: "container1",
						Env:  []corev1.EnvVar{{Name: "EXISTING", Value: "val"}},
					},
				},
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if len(podSpec.Containers[0].Env) != 2 {
					t.Errorf("expected 2 env vars, got %d", len(podSpec.Containers[0].Env))
				}
			},
		},
		{
			name: "applies envFrom to all containers",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				EnvFrom: []corev1.EnvFromSource{
					{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "config"}}},
				},
			},
			podSpec: &corev1.PodSpec{
				Containers: []corev1.Container{
					{Name: "container1"},
				},
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if len(podSpec.Containers[0].EnvFrom) != 1 {
					t.Errorf("expected 1 envFrom, got %d", len(podSpec.Containers[0].EnvFrom))
				}
			},
		},
		{
			name: "applies default resources to containers without resources",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				DefaultResources: &corev1.ResourceRequirements{
					Requests: corev1.ResourceList{
						corev1.ResourceCPU:    resource.MustParse("100m"),
						corev1.ResourceMemory: resource.MustParse("128Mi"),
					},
				},
			},
			podSpec: &corev1.PodSpec{
				Containers: []corev1.Container{
					{Name: "no-resources"},
					{
						Name: "has-resources",
						Resources: corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								corev1.ResourceCPU: resource.MustParse("200m"),
							},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				// Container without resources should get defaults
				if podSpec.Containers[0].Resources.Requests.Cpu().String() != "100m" {
					t.Errorf("expected 100m CPU for container without resources, got %v", podSpec.Containers[0].Resources.Requests.Cpu())
				}
				// Container with resources should keep its own
				if podSpec.Containers[1].Resources.Requests.Cpu().String() != "200m" {
					t.Errorf("expected 200m CPU for container with resources (not overridden), got %v", podSpec.Containers[1].Resources.Requests.Cpu())
				}
			},
		},
		{
			name: "applies default image to containers without image",
			podTemplate: &pipelinev1.PodTemplateDefaults{
				Image: "default-image:latest",
			},
			podSpec: &corev1.PodSpec{
				Containers: []corev1.Container{
					{Name: "no-image"},
					{Name: "has-image", Image: "custom-image:v1"},
				},
			},
			wantCheck: func(t *testing.T, podSpec *corev1.PodSpec) {
				if podSpec.Containers[0].Image != "default-image:latest" {
					t.Errorf("expected default-image:latest, got %s", podSpec.Containers[0].Image)
				}
				if podSpec.Containers[1].Image != "custom-image:v1" {
					t.Errorf("expected custom-image:v1 (not overridden), got %s", podSpec.Containers[1].Image)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r.applyContainerDefaults(tt.podTemplate, tt.podSpec)
			tt.wantCheck(t, tt.podSpec)
		})
	}
}

func TestApplyServiceAccountName(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name     string
		pipeline *pipelinev1.Pipeline
		podSpec  *corev1.PodSpec
		want     string
	}{
		{
			name: "applies service account when not set",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					ServiceAccountName: "pipeline-sa",
				},
			},
			podSpec: &corev1.PodSpec{},
			want:    "pipeline-sa",
		},
		{
			name: "does not override existing service account",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					ServiceAccountName: "pipeline-sa",
				},
			},
			podSpec: &corev1.PodSpec{
				ServiceAccountName: "custom-sa",
			},
			want: "custom-sa",
		},
		{
			name: "does nothing when pipeline has no service account",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{},
			},
			podSpec: &corev1.PodSpec{},
			want:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r.applyServiceAccountName(tt.pipeline, tt.podSpec)
			if tt.podSpec.ServiceAccountName != tt.want {
				t.Errorf("expected service account %q, got %q", tt.want, tt.podSpec.ServiceAccountName)
			}
		})
	}
}

func TestApplyPodTemplateDefaults(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name      string
		pipeline  *pipelinev1.Pipeline
		job       *batchv1.Job
		wantCheck func(t *testing.T, job *batchv1.Job)
	}{
		{
			name: "applies all defaults",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					ServiceAccountName: "test-sa",
					PodTemplate: &pipelinev1.PodTemplateDefaults{
						NodeSelector: map[string]string{"zone": "us-west-1a"},
						Labels:       map[string]string{"app": "pipeline"},
						Image:        "busybox:latest",
					},
				},
			},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{{Name: "main"}},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if job.Spec.Template.Spec.NodeSelector["zone"] != "us-west-1a" {
					t.Error("expected node selector to be applied")
				}
				if job.Spec.Template.Labels["app"] != "pipeline" {
					t.Error("expected labels to be applied")
				}
				if job.Spec.Template.Spec.Containers[0].Image != "busybox:latest" {
					t.Error("expected default image to be applied")
				}
				if job.Spec.Template.Spec.ServiceAccountName != "test-sa" {
					t.Error("expected service account to be applied")
				}
			},
		},
		{
			name: "applies service account even without pod template",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					ServiceAccountName: "standalone-sa",
				},
			},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{{Name: "main"}},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if job.Spec.Template.Spec.ServiceAccountName != "standalone-sa" {
					t.Errorf("expected service account 'standalone-sa', got %q", job.Spec.Template.Spec.ServiceAccountName)
				}
			},
		},
		{
			name: "does nothing when no pod template and no service account",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{},
			},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{{Name: "main", Image: "original:v1"}},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if job.Spec.Template.Spec.Containers[0].Image != "original:v1" {
					t.Error("expected job to remain unchanged")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r.applyPodTemplateDefaults(tt.pipeline, tt.job)
			tt.wantCheck(t, tt.job)
		})
	}
}

func TestApplySharedVolume(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name      string
		pipeline  *pipelinev1.Pipeline
		step      *pipelinev1.PipelineStep
		job       *batchv1.Job
		wantCheck func(t *testing.T, job *batchv1.Job)
	}{
		{
			name: "applies shared volume with defaults",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					SharedVolume: &pipelinev1.SharedVolumeSpec{
						VolumeSource: corev1.VolumeSource{
							EmptyDir: &corev1.EmptyDirVolumeSource{},
						},
					},
				},
			},
			step: &pipelinev1.PipelineStep{Name: "test-step"},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{{Name: "main"}},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if len(job.Spec.Template.Spec.Volumes) != 1 {
					t.Errorf("expected 1 volume, got %d", len(job.Spec.Template.Spec.Volumes))
				}
				if job.Spec.Template.Spec.Volumes[0].Name != "workspace" {
					t.Errorf("expected volume name 'workspace', got %q", job.Spec.Template.Spec.Volumes[0].Name)
				}
				if len(job.Spec.Template.Spec.Containers[0].VolumeMounts) != 1 {
					t.Errorf("expected 1 volume mount, got %d", len(job.Spec.Template.Spec.Containers[0].VolumeMounts))
				}
				if job.Spec.Template.Spec.Containers[0].VolumeMounts[0].MountPath != "/workspace" {
					t.Errorf("expected mount path '/workspace', got %q", job.Spec.Template.Spec.Containers[0].VolumeMounts[0].MountPath)
				}
			},
		},
		{
			name: "applies shared volume with custom name and path",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					SharedVolume: &pipelinev1.SharedVolumeSpec{
						Name:      "custom-vol",
						MountPath: "/data",
						VolumeSource: corev1.VolumeSource{
							EmptyDir: &corev1.EmptyDirVolumeSource{},
						},
					},
				},
			},
			step: &pipelinev1.PipelineStep{Name: "test-step"},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{{Name: "main"}},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if job.Spec.Template.Spec.Volumes[0].Name != "custom-vol" {
					t.Errorf("expected volume name 'custom-vol', got %q", job.Spec.Template.Spec.Volumes[0].Name)
				}
				if job.Spec.Template.Spec.Containers[0].VolumeMounts[0].MountPath != "/data" {
					t.Errorf("expected mount path '/data', got %q", job.Spec.Template.Spec.Containers[0].VolumeMounts[0].MountPath)
				}
			},
		},
		{
			name: "mounts to all containers",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					SharedVolume: &pipelinev1.SharedVolumeSpec{
						VolumeSource: corev1.VolumeSource{
							EmptyDir: &corev1.EmptyDirVolumeSource{},
						},
					},
				},
			},
			step: &pipelinev1.PipelineStep{Name: "test-step"},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{
								{Name: "container1"},
								{Name: "container2"},
								{Name: "container3"},
							},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				for i, c := range job.Spec.Template.Spec.Containers {
					if len(c.VolumeMounts) != 1 {
						t.Errorf("container %d: expected 1 volume mount, got %d", i, len(c.VolumeMounts))
					}
				}
			},
		},
		{
			name: "does nothing when no shared volume configured",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{},
			},
			step: &pipelinev1.PipelineStep{Name: "test-step"},
			job: &batchv1.Job{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{{Name: "main"}},
						},
					},
				},
			},
			wantCheck: func(t *testing.T, job *batchv1.Job) {
				if len(job.Spec.Template.Spec.Volumes) != 0 {
					t.Errorf("expected 0 volumes, got %d", len(job.Spec.Template.Spec.Volumes))
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r.applySharedVolume(tt.pipeline, tt.step, tt.job)
			tt.wantCheck(t, tt.job)
		})
	}
}

// Helper functions
func boolPtr(b bool) *bool {
	return &b
}

func stringPtr(s string) *string {
	return &s
}
