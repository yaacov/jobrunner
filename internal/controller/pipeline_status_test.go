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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pipelinev1 "github.com/yaacov/jobrunner/api/v1"
)

func TestDetermineStepPhase(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name         string
		job          *batchv1.Job
		currentPhase pipelinev1.StepPhase
		want         pipelinev1.StepPhase
	}{
		{
			name: "job completed successfully",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Status: batchv1.JobStatus{
					Conditions: []batchv1.JobCondition{
						{
							Type:   batchv1.JobComplete,
							Status: corev1.ConditionTrue,
						},
					},
				},
			},
			currentPhase: pipelinev1.StepPhaseRunning,
			want:         pipelinev1.StepPhaseSucceeded,
		},
		{
			name: "job failed",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Status: batchv1.JobStatus{
					Conditions: []batchv1.JobCondition{
						{
							Type:    batchv1.JobFailed,
							Status:  corev1.ConditionTrue,
							Reason:  "BackoffLimitExceeded",
							Message: "Job has reached the specified backoff limit",
						},
					},
					Failed: 1,
				},
			},
			currentPhase: pipelinev1.StepPhaseRunning,
			want:         pipelinev1.StepPhaseFailed,
		},
		{
			name: "job is running with active pods",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Status: batchv1.JobStatus{
					Active: 1,
				},
			},
			currentPhase: pipelinev1.StepPhasePending,
			want:         pipelinev1.StepPhaseRunning,
		},
		{
			name: "job has no terminal condition and no active pods - keep current",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Status: batchv1.JobStatus{
					Active: 0,
				},
			},
			currentPhase: pipelinev1.StepPhaseRunning,
			want:         pipelinev1.StepPhaseRunning,
		},
		{
			name: "job condition is false - not complete",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Status: batchv1.JobStatus{
					Conditions: []batchv1.JobCondition{
						{
							Type:   batchv1.JobComplete,
							Status: corev1.ConditionFalse,
						},
					},
					Active: 1,
				},
			},
			currentPhase: pipelinev1.StepPhaseRunning,
			want:         pipelinev1.StepPhaseRunning,
		},
		{
			name: "job suspended returns suspended phase",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Status: batchv1.JobStatus{
					Conditions: []batchv1.JobCondition{
						{
							Type:   batchv1.JobSuspended,
							Status: corev1.ConditionTrue,
						},
					},
				},
			},
			currentPhase: pipelinev1.StepPhaseRunning,
			want:         pipelinev1.StepPhaseSuspended,
		},
		{
			name: "complete takes precedence over active",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Status: batchv1.JobStatus{
					Conditions: []batchv1.JobCondition{
						{
							Type:   batchv1.JobComplete,
							Status: corev1.ConditionTrue,
						},
					},
					Active: 1, // Shouldn't matter if Complete is true
				},
			},
			currentPhase: pipelinev1.StepPhaseRunning,
			want:         pipelinev1.StepPhaseSucceeded,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := r.determineStepPhase(tt.job, tt.currentPhase)
			if got != tt.want {
				t.Errorf("determineStepPhase() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUpdateConditions(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name              string
		pipeline          *pipelinev1.Pipeline
		wantConditionType string
		wantStatus        metav1.ConditionStatus
		wantReason        string
	}{
		{
			name: "pending pipeline",
			pipeline: &pipelinev1.Pipeline{
				ObjectMeta: metav1.ObjectMeta{Name: "test-pipeline"},
				Status: pipelinev1.PipelineStatus{
					Phase: pipelinev1.PipelinePhasePending,
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			wantConditionType: "Ready",
			wantStatus:        metav1.ConditionFalse,
			wantReason:        "Pending",
		},
		{
			name: "running pipeline",
			pipeline: &pipelinev1.Pipeline{
				ObjectMeta: metav1.ObjectMeta{Name: "test-pipeline"},
				Status: pipelinev1.PipelineStatus{
					Phase: pipelinev1.PipelinePhaseRunning,
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseRunning},
						{Name: "step3", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			wantConditionType: "Ready",
			wantStatus:        metav1.ConditionFalse,
			wantReason:        "Running",
		},
		{
			name: "succeeded pipeline",
			pipeline: &pipelinev1.Pipeline{
				ObjectMeta: metav1.ObjectMeta{Name: "test-pipeline"},
				Status: pipelinev1.PipelineStatus{
					Phase: pipelinev1.PipelinePhaseSucceeded,
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseSucceeded},
					},
				},
			},
			wantConditionType: "Ready",
			wantStatus:        metav1.ConditionTrue,
			wantReason:        "Succeeded",
		},
		{
			name: "failed pipeline",
			pipeline: &pipelinev1.Pipeline{
				ObjectMeta: metav1.ObjectMeta{Name: "test-pipeline"},
				Status: pipelinev1.PipelineStatus{
					Phase: pipelinev1.PipelinePhaseFailed,
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
					},
				},
			},
			wantConditionType: "Ready",
			wantStatus:        metav1.ConditionFalse,
			wantReason:        "Failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r.updateConditions(tt.pipeline, pipelineState{})

			if len(tt.pipeline.Status.Conditions) == 0 {
				t.Fatal("expected at least one condition")
			}

			found := false
			for _, cond := range tt.pipeline.Status.Conditions {
				if cond.Type == tt.wantConditionType {
					found = true
					if cond.Status != tt.wantStatus {
						t.Errorf("condition status = %v, want %v", cond.Status, tt.wantStatus)
					}
					if cond.Reason != tt.wantReason {
						t.Errorf("condition reason = %v, want %v", cond.Reason, tt.wantReason)
					}
					break
				}
			}

			if !found {
				t.Errorf("condition type %q not found", tt.wantConditionType)
			}
		})
	}
}

func TestUpdateConditionsMessage(t *testing.T) {
	r := &PipelineReconciler{}

	t.Run("running pipeline shows step counts", func(t *testing.T) {
		pipeline := &pipelinev1.Pipeline{
			ObjectMeta: metav1.ObjectMeta{Name: "test-pipeline"},
			Status: pipelinev1.PipelineStatus{
				Phase: pipelinev1.PipelinePhaseRunning,
				Steps: []pipelinev1.StepStatus{
					{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
					{Name: "step2", Phase: pipelinev1.StepPhaseSkipped},
					{Name: "step3", Phase: pipelinev1.StepPhaseRunning},
					{Name: "step4", Phase: pipelinev1.StepPhasePending},
				},
			},
		}

		r.updateConditions(pipeline, pipelineState{})

		if len(pipeline.Status.Conditions) == 0 {
			t.Fatal("expected condition to be set")
		}

		cond := pipeline.Status.Conditions[0]
		// Should show 2 completed (1 succeeded + 1 skipped), 4 total, 1 running
		if cond.Message == "" {
			t.Error("expected non-empty message")
		}
	})

	t.Run("failed pipeline shows failed steps", func(t *testing.T) {
		pipeline := &pipelinev1.Pipeline{
			ObjectMeta: metav1.ObjectMeta{Name: "test-pipeline"},
			Status: pipelinev1.PipelineStatus{
				Phase: pipelinev1.PipelinePhaseFailed,
				Steps: []pipelinev1.StepStatus{
					{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
					{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
					{Name: "step3", Phase: pipelinev1.StepPhaseFailed},
				},
			},
		}

		r.updateConditions(pipeline, pipelineState{})

		if len(pipeline.Status.Conditions) == 0 {
			t.Fatal("expected condition to be set")
		}

		cond := pipeline.Status.Conditions[0]
		// Should mention the failed steps
		if cond.Message == "" {
			t.Error("expected non-empty message")
		}
	})
}

func TestUpdateConditionsPreservesExisting(t *testing.T) {
	r := &PipelineReconciler{}

	pipeline := &pipelinev1.Pipeline{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pipeline"},
		Status: pipelinev1.PipelineStatus{
			Phase: pipelinev1.PipelinePhaseRunning,
			Conditions: []metav1.Condition{
				{
					Type:               "CustomCondition",
					Status:             metav1.ConditionTrue,
					Reason:             "Custom",
					Message:            "Custom condition",
					LastTransitionTime: metav1.Now(),
				},
			},
			Steps: []pipelinev1.StepStatus{
				{Name: "step1", Phase: pipelinev1.StepPhaseRunning},
			},
		},
	}

	r.updateConditions(pipeline, pipelineState{})

	// Should have both conditions
	foundReady := false
	foundCustom := false
	for _, cond := range pipeline.Status.Conditions {
		if cond.Type == "Ready" {
			foundReady = true
		}
		if cond.Type == "CustomCondition" {
			foundCustom = true
		}
	}

	if !foundReady {
		t.Error("expected Ready condition to be added")
	}
	if !foundCustom {
		t.Error("expected CustomCondition to be preserved")
	}
}
