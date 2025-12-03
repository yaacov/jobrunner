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

func TestCheckSequentialExecution(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name      string
		pipeline  *pipelinev1.Pipeline
		step      *pipelinev1.PipelineStep
		wantReady bool
		wantSkip  bool
	}{
		{
			name: "first step is always ready",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhasePending},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step:      &pipelinev1.PipelineStep{Name: "step1"},
			wantReady: true,
			wantSkip:  false,
		},
		{
			name: "second step ready when first succeeds",
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
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step:      &pipelinev1.PipelineStep{Name: "step2"},
			wantReady: true,
			wantSkip:  false,
		},
		{
			name: "second step waits when first is running",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseRunning},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step:      &pipelinev1.PipelineStep{Name: "step2"},
			wantReady: false,
			wantSkip:  false,
		},
		{
			name: "second step waits when first is pending",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhasePending},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step:      &pipelinev1.PipelineStep{Name: "step2"},
			wantReady: false,
			wantSkip:  false,
		},
		{
			name: "second step skipped when first fails",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step:      &pipelinev1.PipelineStep{Name: "step2"},
			wantReady: false,
			wantSkip:  true,
		},
		{
			name: "second step skipped when first is skipped",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSkipped},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step:      &pipelinev1.PipelineStep{Name: "step2"},
			wantReady: false,
			wantSkip:  true,
		},
		{
			name: "third step ready when all previous succeed",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
						{Name: "step3", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step3", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step:      &pipelinev1.PipelineStep{Name: "step3"},
			wantReady: true,
			wantSkip:  false,
		},
		{
			name: "third step waits when second is running",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
						{Name: "step3", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseRunning},
						{Name: "step3", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step:      &pipelinev1.PipelineStep{Name: "step3"},
			wantReady: false,
			wantSkip:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ready, skip := r.checkSequentialExecution(tt.pipeline, tt.step)
			if ready != tt.wantReady {
				t.Errorf("ready = %v, want %v", ready, tt.wantReady)
			}
			if skip != tt.wantSkip {
				t.Errorf("skip = %v, want %v", skip, tt.wantSkip)
			}
		})
	}
}

func TestCheckConditionalExecution(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name      string
		pipeline  *pipelinev1.Pipeline
		step      *pipelinev1.PipelineStep
		wantReady bool
		wantSkip  bool
	}{
		{
			name: "runIf success AND - all succeed",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
						{Name: "step3", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step3", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step: &pipelinev1.PipelineStep{
				Name: "step3",
				RunIf: &pipelinev1.RunIfCondition{
					Condition: pipelinev1.RunIfConditionSuccess,
					Operator:  pipelinev1.RunIfOperatorAnd,
					Steps:     []string{"step1", "step2"},
				},
			},
			wantReady: true,
			wantSkip:  false,
		},
		{
			name: "runIf success AND - one fails",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
						{Name: "step3", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step3", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step: &pipelinev1.PipelineStep{
				Name: "step3",
				RunIf: &pipelinev1.RunIfCondition{
					Condition: pipelinev1.RunIfConditionSuccess,
					Operator:  pipelinev1.RunIfOperatorAnd,
					Steps:     []string{"step1", "step2"},
				},
			},
			wantReady: false,
			wantSkip:  true,
		},
		{
			name: "runIf success OR - one succeeds",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
						{Name: "step3", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step3", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step: &pipelinev1.PipelineStep{
				Name: "step3",
				RunIf: &pipelinev1.RunIfCondition{
					Condition: pipelinev1.RunIfConditionSuccess,
					Operator:  pipelinev1.RunIfOperatorOr,
					Steps:     []string{"step1", "step2"},
				},
			},
			wantReady: true,
			wantSkip:  false,
		},
		{
			name: "runIf success OR - all fail",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
						{Name: "step3", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step3", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step: &pipelinev1.PipelineStep{
				Name: "step3",
				RunIf: &pipelinev1.RunIfCondition{
					Condition: pipelinev1.RunIfConditionSuccess,
					Operator:  pipelinev1.RunIfOperatorOr,
					Steps:     []string{"step1", "step2"},
				},
			},
			wantReady: false,
			wantSkip:  true,
		},
		{
			name: "runIf fail AND - all fail",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
						{Name: "cleanup", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
						{Name: "cleanup", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step: &pipelinev1.PipelineStep{
				Name: "cleanup",
				RunIf: &pipelinev1.RunIfCondition{
					Condition: pipelinev1.RunIfConditionFail,
					Operator:  pipelinev1.RunIfOperatorAnd,
					Steps:     []string{"step1", "step2"},
				},
			},
			wantReady: true,
			wantSkip:  false,
		},
		{
			name: "runIf fail OR - one fails",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
						{Name: "cleanup", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
						{Name: "cleanup", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step: &pipelinev1.PipelineStep{
				Name: "cleanup",
				RunIf: &pipelinev1.RunIfCondition{
					Condition: pipelinev1.RunIfConditionFail,
					Operator:  pipelinev1.RunIfOperatorOr,
					Steps:     []string{"step1", "step2"},
				},
			},
			wantReady: true,
			wantSkip:  false,
		},
		{
			name: "runIf waits when dependency is running",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseRunning},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step: &pipelinev1.PipelineStep{
				Name: "step2",
				RunIf: &pipelinev1.RunIfCondition{
					Condition: pipelinev1.RunIfConditionSuccess,
					Operator:  pipelinev1.RunIfOperatorAnd,
					Steps:     []string{"step1"},
				},
			},
			wantReady: false,
			wantSkip:  false,
		},
		{
			name: "runIf waits when dependency is pending",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhasePending},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step: &pipelinev1.PipelineStep{
				Name: "step2",
				RunIf: &pipelinev1.RunIfCondition{
					Condition: pipelinev1.RunIfConditionSuccess,
					Operator:  pipelinev1.RunIfOperatorAnd,
					Steps:     []string{"step1"},
				},
			},
			wantReady: false,
			wantSkip:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ready, skip := r.checkConditionalExecution(tt.pipeline, tt.step)
			if ready != tt.wantReady {
				t.Errorf("ready = %v, want %v", ready, tt.wantReady)
			}
			if skip != tt.wantSkip {
				t.Errorf("skip = %v, want %v", skip, tt.wantSkip)
			}
		})
	}
}

func TestAreDependenciesSatisfied(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name      string
		pipeline  *pipelinev1.Pipeline
		step      *pipelinev1.PipelineStep
		wantReady bool
		wantSkip  bool
	}{
		{
			name: "step with runIf uses conditional execution",
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
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step: &pipelinev1.PipelineStep{
				Name: "step2",
				RunIf: &pipelinev1.RunIfCondition{
					Condition: pipelinev1.RunIfConditionSuccess,
					Steps:     []string{"step1"},
				},
			},
			wantReady: true,
			wantSkip:  false,
		},
		{
			name: "step without runIf uses sequential execution",
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
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			step:      &pipelinev1.PipelineStep{Name: "step2"},
			wantReady: true,
			wantSkip:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ready, skip := r.areDependenciesSatisfied(tt.pipeline, tt.step)
			if ready != tt.wantReady {
				t.Errorf("ready = %v, want %v", ready, tt.wantReady)
			}
			if skip != tt.wantSkip {
				t.Errorf("skip = %v, want %v", skip, tt.wantSkip)
			}
		})
	}
}

func TestCheckStepStatuses(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name             string
		pipeline         *pipelinev1.Pipeline
		stepNames        []string
		checkAll         bool
		checkFailure     bool
		wantConditionMet bool
		wantAllComplete  bool
	}{
		{
			name: "all success - checkAll=true, checkFailure=false",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseSucceeded},
					},
				},
			},
			stepNames:        []string{"step1", "step2"},
			checkAll:         true,
			checkFailure:     false,
			wantConditionMet: true,
			wantAllComplete:  true,
		},
		{
			name: "one success - checkAll=true, checkFailure=false",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
					},
				},
			},
			stepNames:        []string{"step1", "step2"},
			checkAll:         true,
			checkFailure:     false,
			wantConditionMet: false,
			wantAllComplete:  true,
		},
		{
			name: "one success - checkAll=false, checkFailure=false",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
					},
				},
			},
			stepNames:        []string{"step1", "step2"},
			checkAll:         false,
			checkFailure:     false,
			wantConditionMet: true,
			wantAllComplete:  true,
		},
		{
			name: "all failed - checkAll=true, checkFailure=true",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
					},
				},
			},
			stepNames:        []string{"step1", "step2"},
			checkAll:         true,
			checkFailure:     true,
			wantConditionMet: true,
			wantAllComplete:  true,
		},
		{
			name: "one failed - checkAll=false, checkFailure=true",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseFailed},
					},
				},
			},
			stepNames:        []string{"step1", "step2"},
			checkAll:         false,
			checkFailure:     true,
			wantConditionMet: true,
			wantAllComplete:  true,
		},
		{
			name: "one running - not complete",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSucceeded},
						{Name: "step2", Phase: pipelinev1.StepPhaseRunning},
					},
				},
			},
			stepNames:        []string{"step1", "step2"},
			checkAll:         true,
			checkFailure:     false,
			wantConditionMet: false,
			wantAllComplete:  false,
		},
		{
			name: "skipped steps don't match",
			pipeline: &pipelinev1.Pipeline{
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseSkipped},
						{Name: "step2", Phase: pipelinev1.StepPhaseSucceeded},
					},
				},
			},
			stepNames:        []string{"step1", "step2"},
			checkAll:         true,
			checkFailure:     false,
			wantConditionMet: false, // step1 is skipped, not succeeded
			wantAllComplete:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conditionMet, allComplete := r.checkStepStatuses(tt.pipeline, tt.stepNames, tt.checkAll, tt.checkFailure)
			if conditionMet != tt.wantConditionMet {
				t.Errorf("conditionMet = %v, want %v", conditionMet, tt.wantConditionMet)
			}
			if allComplete != tt.wantAllComplete {
				t.Errorf("allComplete = %v, want %v", allComplete, tt.wantAllComplete)
			}
		})
	}
}

func TestHasPendingFailureHandlers(t *testing.T) {
	r := &PipelineReconciler{}

	tests := []struct {
		name     string
		pipeline *pipelinev1.Pipeline
		want     bool
	}{
		{
			name: "has pending failure handler",
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
			want: true,
		},
		{
			name: "no pending failure handlers",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{Name: "step2", JobSpec: batchv1.JobSpec{}},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			want: false,
		},
		{
			name: "failure handler already running",
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
						{Name: "cleanup", Phase: pipelinev1.StepPhaseRunning},
					},
				},
			},
			want: false,
		},
		{
			name: "pending step with success condition is not a failure handler",
			pipeline: &pipelinev1.Pipeline{
				Spec: pipelinev1.PipelineSpec{
					Steps: []pipelinev1.PipelineStep{
						{Name: "step1", JobSpec: batchv1.JobSpec{}},
						{
							Name: "step2",
							RunIf: &pipelinev1.RunIfCondition{
								Condition: pipelinev1.RunIfConditionSuccess,
								Steps:     []string{"step1"},
							},
							JobSpec: batchv1.JobSpec{},
						},
					},
				},
				Status: pipelinev1.PipelineStatus{
					Steps: []pipelinev1.StepStatus{
						{Name: "step1", Phase: pipelinev1.StepPhaseFailed},
						{Name: "step2", Phase: pipelinev1.StepPhasePending},
					},
				},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := r.hasPendingFailureHandlers(tt.pipeline)
			if got != tt.want {
				t.Errorf("hasPendingFailureHandlers() = %v, want %v", got, tt.want)
			}
		})
	}
}
