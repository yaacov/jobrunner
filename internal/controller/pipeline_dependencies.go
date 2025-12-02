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
	"sigs.k8s.io/controller-runtime/pkg/log"

	pipelinev1 "github.com/yaacov/jobrunner/api/v1"
)

// areDependenciesSatisfied checks if a step's dependencies are met and whether it should run
// Returns (ready, shouldSkip) where:
//   - ready=true means the step can start now
//   - shouldSkip=true means the step should be skipped (conditions not met)
func (r *PipelineReconciler) areDependenciesSatisfied(pipeline *pipelinev1.Pipeline, step *pipelinev1.PipelineStep) (ready bool, shouldSkip bool) {
	// If step has a runIf condition, check it
	if step.HasConditionalExecution() {
		return r.checkConditionalExecution(pipeline, step)
	}

	// Default behavior: sequential execution - wait for all previous steps to succeed
	return r.checkSequentialExecution(pipeline, step)
}

// checkSequentialExecution checks if all previous steps have succeeded (default behavior)
// Steps run in order of the list - each step waits for all previous steps to succeed
func (r *PipelineReconciler) checkSequentialExecution(pipeline *pipelinev1.Pipeline, step *pipelinev1.PipelineStep) (ready bool, shouldSkip bool) {
	// Find the index of this step
	stepIndex := -1
	for i, s := range pipeline.Spec.Steps {
		if s.Name == step.Name {
			stepIndex = i
			break
		}
	}

	if stepIndex == 0 {
		// First step is always ready
		log.Log.V(1).Info("First step in pipeline is ready",
			"step", step.Name)
		return true, false
	}

	// Check all previous steps
	pendingSteps := []string{}
	failedSteps := []string{}
	for i := 0; i < stepIndex; i++ {
		prevStep := &pipeline.Spec.Steps[i]
		prevStatus := r.getStepStatus(pipeline, prevStep.Name)

		switch prevStatus.Phase {
		case pipelinev1.StepPhaseSucceeded:
			// Previous step succeeded, continue checking
			continue
		case pipelinev1.StepPhaseFailed:
			// A previous step failed, skip this step
			failedSteps = append(failedSteps, prevStep.Name)
		case pipelinev1.StepPhaseSkipped:
			// A previous step was skipped, skip this step too
			failedSteps = append(failedSteps, prevStep.Name)
		case pipelinev1.StepPhasePending, pipelinev1.StepPhaseRunning:
			// Previous step not complete, wait
			pendingSteps = append(pendingSteps, prevStep.Name)
		}
	}

	// If any previous steps are pending or running, wait
	if len(pendingSteps) > 0 {
		log.Log.V(1).Info("Step waiting for previous steps to complete (sequential execution)",
			"step", step.Name,
			"pendingSteps", pendingSteps)
		return false, false
	}

	// If any previous steps failed or were skipped, skip this step
	if len(failedSteps) > 0 {
		log.Log.Info("Step skipped - previous steps failed or were skipped (sequential execution)",
			"step", step.Name,
			"failedSteps", failedSteps)
		return false, true
	}

	// All previous steps succeeded
	log.Log.Info("Step ready to run - all previous steps succeeded (sequential execution)",
		"step", step.Name)
	return true, false
}

// checkConditionalExecution checks the runIf condition
// These allow steps to run out of order based on specific conditions
func (r *PipelineReconciler) checkConditionalExecution(pipeline *pipelinev1.Pipeline, step *pipelinev1.PipelineStep) (ready bool, shouldSkip bool) {
	runIf := step.RunIf
	if runIf == nil {
		// Should not happen, but handle gracefully
		return false, false
	}

	checkFailure := runIf.IsCheckingFailure()
	checkAll := runIf.RequiresAll()

	conditionMet, allComplete := r.checkStepStatuses(pipeline, runIf.Steps, checkAll, checkFailure)

	if !allComplete {
		log.Log.V(1).Info("Step waiting for runIf steps to complete",
			"step", step.Name,
			"condition", runIf.GetCondition(),
			"operator", runIf.GetOperator(),
			"waitingFor", runIf.Steps)
		return false, false
	}

	if !conditionMet {
		log.Log.Info("Step skipped - runIf condition not met",
			"step", step.Name,
			"condition", runIf.GetCondition(),
			"operator", runIf.GetOperator(),
			"steps", runIf.Steps)
		return false, true
	}

	log.Log.Info("Step ready to run - runIf condition met",
		"step", step.Name,
		"condition", runIf.GetCondition(),
		"operator", runIf.GetOperator(),
		"steps", runIf.Steps)
	return true, false
}

// checkStepStatuses checks the status of a list of steps
// Returns (conditionMet, allComplete) where:
//   - conditionMet: true if the condition is satisfied (all/any success/fail based on params)
//   - allComplete: true if all steps are in a terminal state
//
// If checkAll is true, checks if ALL steps meet the condition; otherwise checks if ANY step meets it
// If checkFailure is true, checks for failure; otherwise checks for success
func (r *PipelineReconciler) checkStepStatuses(pipeline *pipelinev1.Pipeline, stepNames []string, checkAll bool, checkFailure bool) (conditionMet bool, allComplete bool) {
	allComplete = true
	matchCount := 0

	for _, name := range stepNames {
		status := r.getStepStatus(pipeline, name)
		if status == nil {
			log.Log.Info("Referenced step not found",
				"referencedStep", name,
				"pipeline", pipeline.Name)
			allComplete = false
			continue
		}

		switch status.Phase {
		case pipelinev1.StepPhaseSucceeded:
			if !checkFailure {
				matchCount++
			}
		case pipelinev1.StepPhaseFailed:
			if checkFailure {
				matchCount++
			}
		case pipelinev1.StepPhaseSkipped:
			// Skipped steps don't match any condition
			continue
		case pipelinev1.StepPhasePending, pipelinev1.StepPhaseRunning:
			allComplete = false
		}
	}

	if !allComplete {
		return false, false
	}

	// Check if condition is met
	if checkAll {
		// All steps must match
		conditionMet = (matchCount == len(stepNames))
	} else {
		// At least one step must match
		conditionMet = (matchCount > 0)
	}

	return conditionMet, true
}

// shouldSkipStep checks if a step should be skipped for other reasons
// This is a placeholder for future validation logic
func (r *PipelineReconciler) shouldSkipStep(pipeline *pipelinev1.Pipeline, step *pipelinev1.PipelineStep) bool {
	// Additional validation logic can go here
	// For now, this is a placeholder for future enhancements
	return false
}

// hasPendingFailureHandlers checks if there are pending steps that handle failures
func (r *PipelineReconciler) hasPendingFailureHandlers(pipeline *pipelinev1.Pipeline) bool {
	pendingHandlers := []string{}

	// Check if there are any pending steps that could run on failure
	for i := range pipeline.Spec.Steps {
		step := &pipeline.Spec.Steps[i]
		stepStatus := r.getStepStatus(pipeline, step.Name)

		if stepStatus.Phase != pipelinev1.StepPhasePending {
			continue
		}

		// Check if this step has failure-related conditions
		if step.RunIf != nil && step.RunIf.IsCheckingFailure() {
			pendingHandlers = append(pendingHandlers, step.Name)
		}
	}

	if len(pendingHandlers) > 0 {
		log.Log.Info("Pending failure handlers detected",
			"pipeline", pipeline.Name,
			"handlers", pendingHandlers)
		return true
	}

	return false
}
