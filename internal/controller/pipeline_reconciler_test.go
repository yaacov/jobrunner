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

	pipelinev1 "github.com/yaacov/jobrunner/api/v1"
)

func TestAnalyzePipelineState(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name                          string
		pipeline                      *pipelinev1.Pipeline
		wantAllSucceeded              bool
		wantAnyFailed                 bool
		wantAnyRunning                bool
		wantAnyPending                bool
		wantHasPendingFailureHandlers bool
	}{
		{
			name: "all steps succeeded",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step3", Phase: pipelinev1.StepPhaseSucceeded},
					},
				},
			},
			wantAllSucceeded:              true,
			wantAnyFailed:                 false,
			wantAnyRunning:                false,
			wantAnyPending:                false,
			wantHasPendingFailureHandlers: false,
		},
		{
			name: "all steps succeeded or skipped",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseSkipped},
						{Name: "step3", Phase: pipelinev1.StepPhaseSucceeded},
					},
				},
			},
			wantAllSucceeded:              true,
			wantAnyFailed:                 false,
			wantAnyRunning:                false,
			wantAnyPending:                false,
			wantHasPendingFailureHandlers: false,
		},
		{
			name: "one step failed",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
					},
				},
			},
			wantAllSucceeded:              false,
			wantAnyFailed:                 true,
			wantAnyRunning:                false,
			wantAnyPending:                false,
			wantHasPendingFailureHandlers: false,
		},
		{
			name: "one step running",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseRunning},
					},
				},
			},
			wantAllSucceeded:              false,
			wantAnyFailed:                 false,
			wantAnyRunning:                true,
			wantAnyPending:                false,
			wantHasPendingFailureHandlers: false,
		},
		{
			name: "one step pending",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			wantAllSucceeded:              false,
			wantAnyFailed:                 false,
			wantAnyRunning:                false,
			wantAnyPending:                true,
			wantHasPendingFailureHandlers: false,
		},
		{
			name: "failed with pending failure handler",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{
							Name: "cleanup",
							RunIf: &pipelinev1.RunIfCondition{
								Condition: pipelinev1.RunIfConditionFail,
								Steps:     []string{"step1"},
							},
							JobSpec: batchv1.JobSpec{},
						},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseFailed},
						{Name: "cleanup", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			wantAllSucceeded:              false,
			wantAnyFailed:                 true,
			wantAnyRunning:                false,
			wantAnyPending:                true,
			wantHasPendingFailureHandlers: true,
		},
		{
			name: "mixed states",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
						{Name: "step3", JobSpec: batchv1.JobSpec{}},
						{Name: "step4", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step3", Phase: pipelinev1.StepPhaseRunning},
						{Name: "step4", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			wantAllSucceeded:              false,
			wantAnyFailed:                 true,
			wantAnyRunning:                true,
			wantAnyPending:                true,
			wantHasPendingFailureHandlers: false, // No failure handler configured
		},
		{
			name: "empty pipeline",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{},
				},
			},
			wantAllSucceeded:              true, // vacuously true
			wantAnyFailed:                 false,
			wantAnyRunning:                false,
			wantAnyPending:                false,
			wantHasPendingFailureHandlers: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := r.analyzePipelineState(tt.pipeline)

			if state.allSucceeded != tt.wantAllSucceeded {
				t.Errorf("allSucceeded = %v, want %v", state.allSucceeded, tt.wantAllSucceeded)
			}
			if state.anyFailed != tt.wantAnyFailed {
				t.Errorf("anyFailed = %v, want %v", state.anyFailed, tt.wantAnyFailed)
			}
			if state.anyRunning != tt.wantAnyRunning {
				t.Errorf("anyRunning = %v, want %v", state.anyRunning, tt.wantAnyRunning)
			}
			if state.anyPending != tt.wantAnyPending {
				t.Errorf("anyPending = %v, want %v", state.anyPending, tt.wantAnyPending)
			}
			if state.hasPendingFailureHandlers != tt.wantHasPendingFailureHandlers {
				t.Errorf("hasPendingFailureHandlers = %v, want %v", state.hasPendingFailureHandlers, tt.wantHasPendingFailureHandlers)
			}
		})
	}
}

func TestGetStepStatus(t *testing.T) {
	r := &PipelineReconciler{}

	pipeline := &pipelinev1.Pipeline{
		Status: pipelinev1.PipelineStatus{
			Steps: []pipelinev1.StepStatus{
				{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded, JobName: "job1"},
				{Name: "step2", Phase: pipelinev1.StepPhaseRunning, JobName: "job2"},
				{Name: "step3", Phase: pipelinev1.StepPhasePending},
			},
		},
	}

	tests := []struct {
		name     string
		stepName string
		wantNil  bool
		want     *pipelinev1.StepStatus
	}{
		{
			name:     "finds existing step",
			stepName: "step1",
			wantNil:  false,
		},
		{
			name:     "finds second step",
			stepName: "step2",
			wantNil:  false,
		},
		{
			name:     "returns nil for non-existent step",
			stepName: "nonexistent",
			wantNil:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := r.getStepStatus(pipeline, tt.stepName)
			if tt.wantNil {
				if got != nil {
					t.Errorf("expected nil, got %v", got)
				}
			} else {
				if got == nil {
					t.Error("expected non-nil result")
				} else if got.Name != tt.stepName {
					t.Errorf("expected step name %q, got %q", tt.stepName, got.Name)
				}
			}
		})
	}
}

func TestGetStepStatusModification(t *testing.T) {
	r := &PipelineReconciler{}

	pipeline := &pipelinev1.Pipeline{
		Status: pipelinev1.PipelineStatus{
			Steps: []pipelinev1.StepStatus{
				{Name: "step1", Phase: pipelinev1.StepPhasePending},
			},
		},
	}

	// Get pointer and modify
	status := r.getStepStatus(pipeline, "step1")
	if status == nil {
		t.Fatal("expected to find step1")
	}

	status.Phase = pipelinev1.StepPhaseRunning
	status.JobName = "test-job"

	// Verify modification persisted
	if pipeline.Status.Steps[0].Phase != pipelinev1.StepPhaseRunning {
		t.Error("modification should persist to original pipeline")
	}
	if pipeline.Status.Steps[0].JobName != "test-job" {
		t.Error("job name modification should persist to original pipeline")
	}
}
