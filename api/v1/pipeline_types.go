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

package v1

import (
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// PipelineSpec defines the desired state of Pipeline
type PipelineSpec struct {
	// Steps defines the list of jobs to run
	// +kubebuilder:validation:MinItems=1
	Steps []PipelineStep `json:"steps"`

	// ServiceAccountName is the service account to use for all jobs
	// Can be overridden per step in the job's pod spec
	// +optional
	ServiceAccountName string `json:"serviceAccountName,omitempty"`

	// SharedVolume defines a volume that will be mounted to all steps
	// +optional
	SharedVolume *SharedVolumeSpec `json:"sharedVolume,omitempty"`

	// PodTemplate defines common pod configuration applied to all steps
	// +optional
	PodTemplate *PodTemplateDefaults `json:"podTemplate,omitempty"`
}

// SharedVolumeSpec defines the shared volume configuration
type SharedVolumeSpec struct {
	// Name is the name of the volume
	// +kubebuilder:default=workspace
	// +optional
	Name string `json:"name,omitempty"`

	// MountPath is where the volume will be mounted in each step
	// +kubebuilder:default=/workspace
	// +optional
	MountPath string `json:"mountPath,omitempty"`

	// VolumeSource defines the volume source (PVC, emptyDir, etc.)
	corev1.VolumeSource `json:",inline"`
}

// PodTemplateDefaults defines common pod settings applied to all steps
type PodTemplateDefaults struct {
	// NodeSelector must match a node's labels for pods to be scheduled
	// +optional
	NodeSelector map[string]string `json:"nodeSelector,omitempty"`

	// Affinity defines scheduling constraints
	// +optional
	Affinity *corev1.Affinity `json:"affinity,omitempty"`

	// Tolerations allow scheduling onto nodes with matching taints
	// +optional
	Tolerations []corev1.Toleration `json:"tolerations,omitempty"`

	// SecurityContext holds pod-level security attributes
	// +optional
	SecurityContext *corev1.PodSecurityContext `json:"securityContext,omitempty"`

	// ImagePullSecrets for pulling container images
	// +optional
	ImagePullSecrets []corev1.LocalObjectReference `json:"imagePullSecrets,omitempty"`

	// PriorityClassName for pod priority
	// +optional
	PriorityClassName string `json:"priorityClassName,omitempty"`

	// RuntimeClassName for container runtime
	// +optional
	RuntimeClassName *string `json:"runtimeClassName,omitempty"`

	// SchedulerName for custom scheduler
	// +optional
	SchedulerName string `json:"schedulerName,omitempty"`

	// Labels to add to all pods
	// +optional
	Labels map[string]string `json:"labels,omitempty"`

	// Annotations to add to all pods
	// +optional
	Annotations map[string]string `json:"annotations,omitempty"`

	// DefaultResources applied to containers without resource specs
	// +optional
	DefaultResources *corev1.ResourceRequirements `json:"defaultResources,omitempty"`

	// Image is the default container image applied to containers without an image
	// +optional
	Image string `json:"image,omitempty"`

	// Env variables injected into all containers
	// +optional
	Env []corev1.EnvVar `json:"env,omitempty"`

	// EnvFrom sources injected into all containers
	// +optional
	EnvFrom []corev1.EnvFromSource `json:"envFrom,omitempty"`
}

// PipelineStep defines a single step in the pipeline
type PipelineStep struct {
	// Name is the unique identifier for this step
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:MinLength=1
	// +kubebuilder:validation:MaxLength=63
	// +kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
	Name string `json:"name"`

	// RunIf defines conditional execution for this step
	// If not specified, the step runs sequentially (after all previous steps succeed)
	// +optional
	RunIf *RunIfCondition `json:"runIf,omitempty"`

	// JobSpec is the specification of the job to run
	// +kubebuilder:validation:Required
	JobSpec batchv1.JobSpec `json:"jobSpec"`
}

// RunIfCondition defines when a step should run based on other steps
type RunIfCondition struct {
	// Condition determines whether to check for success or failure
	// +kubebuilder:validation:Enum=success;fail
	// +kubebuilder:default=success
	// +optional
	Condition RunIfConditionType `json:"condition,omitempty"`

	// Operator determines whether ALL or ANY steps must meet the condition
	// +kubebuilder:validation:Enum=and;or
	// +kubebuilder:default=and
	// +optional
	Operator RunIfOperator `json:"operator,omitempty"`

	// Steps is the list of step names to check
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:MinItems=1
	Steps []string `json:"steps"`
}

// RunIfConditionType defines whether to check for success or failure
// +kubebuilder:validation:Enum=success;fail
type RunIfConditionType string

const (
	// RunIfConditionSuccess checks if steps succeeded
	RunIfConditionSuccess RunIfConditionType = "success"
	// RunIfConditionFail checks if steps failed
	RunIfConditionFail RunIfConditionType = "fail"
)

// RunIfOperator defines whether ALL or ANY steps must meet the condition
// +kubebuilder:validation:Enum=and;or
type RunIfOperator string

const (
	// RunIfOperatorAnd requires ALL steps to meet the condition
	RunIfOperatorAnd RunIfOperator = "and"
	// RunIfOperatorOr requires ANY step to meet the condition
	RunIfOperatorOr RunIfOperator = "or"
)

// PipelinePhase represents the current phase of the pipeline
// +kubebuilder:validation:Enum=Pending;Running;Succeeded;Failed
type PipelinePhase string

const (
	PipelinePhasePending   PipelinePhase = "Pending"
	PipelinePhaseRunning   PipelinePhase = "Running"
	PipelinePhaseSucceeded PipelinePhase = "Succeeded"
	PipelinePhaseFailed    PipelinePhase = "Failed"
)

// StepPhase represents the current phase of a step
// +kubebuilder:validation:Enum=Pending;Running;Succeeded;Failed;Skipped
type StepPhase string

const (
	StepPhasePending   StepPhase = "Pending"
	StepPhaseRunning   StepPhase = "Running"
	StepPhaseSucceeded StepPhase = "Succeeded"
	StepPhaseFailed    StepPhase = "Failed"
	StepPhaseSkipped   StepPhase = "Skipped"
)

// StepStatus defines the observed state of a single step
type StepStatus struct {
	// Name is the name of the step
	Name string `json:"name"`

	// Phase is the current phase of this step
	Phase StepPhase `json:"phase,omitempty"`

	// JobName is the name of the Job created for this step
	// +optional
	JobName string `json:"jobName,omitempty"`

	// JobStatus from the underlying job
	// +optional
	JobStatus *batchv1.JobStatus `json:"jobStatus,omitempty"`
}

// PipelineStatus defines the observed state of Pipeline
type PipelineStatus struct {
	// Phase is the current phase of the pipeline
	// +kubebuilder:default=Pending
	Phase PipelinePhase `json:"phase,omitempty"`

	// StartTime is when the pipeline started
	// +optional
	StartTime *metav1.Time `json:"startTime,omitempty"`

	// CompletionTime is when the pipeline completed
	// +optional
	CompletionTime *metav1.Time `json:"completionTime,omitempty"`

	// Steps contains the status of each step
	// +optional
	Steps []StepStatus `json:"steps,omitempty"`

	// Conditions represent the latest observations of the pipeline's state
	// +optional
	// +patchMergeKey=type
	// +patchStrategy=merge
	// +listType=map
	// +listMapKey=type
	Conditions []metav1.Condition `json:"conditions,omitempty" patchStrategy:"merge" patchMergeKey:"type"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:resource:shortName=pl;pipe
// +kubebuilder:printcolumn:name="Phase",type=string,JSONPath=`.status.phase`
// +kubebuilder:printcolumn:name="Age",type=date,JSONPath=`.metadata.creationTimestamp`

// Pipeline is the Schema for the pipelines API
type Pipeline struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   PipelineSpec   `json:"spec,omitempty"`
	Status PipelineStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// PipelineList contains a list of Pipeline
type PipelineList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []Pipeline `json:"items"`
}

func init() {
	SchemeBuilder.Register(&Pipeline{}, &PipelineList{})
}

// Helper methods

func (s *SharedVolumeSpec) GetName() string {
	if s.Name == "" {
		return "workspace"
	}
	return s.Name
}

func (s *SharedVolumeSpec) GetMountPath() string {
	if s.MountPath == "" {
		return "/workspace"
	}
	return s.MountPath
}

// HasConditionalExecution returns true if the step has a runIf condition
func (s *PipelineStep) HasConditionalExecution() bool {
	return s.RunIf != nil
}

// GetCondition returns the condition type (defaults to success)
func (r *RunIfCondition) GetCondition() RunIfConditionType {
	if r.Condition == "" {
		return RunIfConditionSuccess
	}
	return r.Condition
}

// GetOperator returns the operator (defaults to and)
func (r *RunIfCondition) GetOperator() RunIfOperator {
	if r.Operator == "" {
		return RunIfOperatorAnd
	}
	return r.Operator
}

// IsCheckingSuccess returns true if checking for success
func (r *RunIfCondition) IsCheckingSuccess() bool {
	return r.GetCondition() == RunIfConditionSuccess
}

// IsCheckingFailure returns true if checking for failure
func (r *RunIfCondition) IsCheckingFailure() bool {
	return r.GetCondition() == RunIfConditionFail
}

// RequiresAll returns true if all steps must meet the condition
func (r *RunIfCondition) RequiresAll() bool {
	return r.GetOperator() == RunIfOperatorAnd
}

// RequiresAny returns true if any step must meet the condition
func (r *RunIfCondition) RequiresAny() bool {
	return r.GetOperator() == RunIfOperatorOr
}
