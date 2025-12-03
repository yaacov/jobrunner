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
	"time"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"

	pipelinev1 "github.com/yaacov/jobrunner/api/v1"
)

// reconcileDelete handles cleanup when a Pipeline is being deleted
func (r *PipelineReconciler) reconcileDelete(ctx context.Context, pipeline *pipelinev1.Pipeline) (ctrl.Result, error) {
	logger := log.FromContext(ctx)
	logger.Info("Deleting pipeline", "pipeline", pipeline.Name, "namespace", pipeline.Namespace)

	if controllerutil.ContainsFinalizer(pipeline, pipelineFinalizer) {
		// Cleanup: delete all jobs created by this pipeline
		jobList := &batchv1.JobList{}
		if err := r.List(ctx, jobList, client.InNamespace(pipeline.Namespace), client.MatchingLabels{
			"pipeline.yaacov.io/pipeline": pipeline.Name,
		}); err != nil {
			logger.Error(err, "Failed to list jobs for cleanup")
			return ctrl.Result{}, err
		}

		logger.Info("Cleaning up jobs", "count", len(jobList.Items))
		for i := range jobList.Items {
			jobName := jobList.Items[i].Name
			if err := r.Delete(ctx, &jobList.Items[i], client.PropagationPolicy(metav1.DeletePropagationBackground)); err != nil {
				logger.Error(err, "Failed to delete job", "job", jobName)
				return ctrl.Result{}, err
			}
			logger.V(1).Info("Deleted job", "job", jobName)
		}

		// Remove finalizer
		logger.V(1).Info("Removing finalizer")
		controllerutil.RemoveFinalizer(pipeline, pipelineFinalizer)
		if err := r.Update(ctx, pipeline); err != nil {
			logger.Error(err, "Failed to remove finalizer")
			return ctrl.Result{}, err
		}
		logger.Info("Pipeline deleted successfully", "pipeline", pipeline.Name)
	}

	return ctrl.Result{}, nil
}

// reconcilePipeline is the main reconciliation logic for an active Pipeline
func (r *PipelineReconciler) reconcilePipeline(ctx context.Context, pipeline *pipelinev1.Pipeline) (ctrl.Result, error) {
	logger := log.FromContext(ctx)
	logger.V(1).Info("Reconciling pipeline",
		"pipeline", pipeline.Name,
		"phase", pipeline.Status.Phase,
		"stepCount", len(pipeline.Spec.Steps))

	// Initialize step statuses if needed
	if len(pipeline.Status.Steps) == 0 {
		logger.Info("Initializing step statuses")
		if err := r.initializeStepStatuses(ctx, pipeline); err != nil {
			logger.Error(err, "Failed to initialize step statuses")
			return ctrl.Result{}, err
		}
	}

	// Update status of existing jobs
	if err := r.updateStepStatuses(ctx, pipeline); err != nil {
		logger.Error(err, "Failed to update step statuses")
		return ctrl.Result{}, err
	}

	// Analyze pipeline completion state
	pipelineState := r.analyzePipelineState(pipeline)
	logger.V(1).Info("Pipeline state analyzed",
		"allSucceeded", pipelineState.allSucceeded,
		"anyFailed", pipelineState.anyFailed,
		"anyRunning", pipelineState.anyRunning,
		"anyPending", pipelineState.anyPending,
		"hasPendingFailureHandlers", pipelineState.hasPendingFailureHandlers)

	// Update pipeline phase based on analysis
	if err := r.updatePipelinePhase(ctx, pipeline, pipelineState); err != nil {
		logger.Error(err, "Failed to update pipeline phase")
		return ctrl.Result{}, err
	}

	// If pipeline is complete, no need to requeue
	if pipeline.Status.Phase == pipelinev1.PipelinePhaseSucceeded ||
		pipeline.Status.Phase == pipelinev1.PipelinePhaseFailed {
		logger.Info("Pipeline completed", "phase", pipeline.Status.Phase)
		return ctrl.Result{}, nil
	}

	// If pipeline is suspended, log it but still requeue to detect when resumed
	if pipeline.Status.Phase == pipelinev1.PipelinePhaseSuspended {
		logger.Info("Pipeline is suspended, waiting for jobs to be resumed",
			"suspendedSteps", pipelineState.suspendedSteps)
	}

	// Try to start pending steps
	if err := r.startReadySteps(ctx, pipeline); err != nil {
		logger.Error(err, "Failed to start ready steps")
		return ctrl.Result{}, err
	}

	// Requeue to check status again
	logger.V(1).Info("Requeuing pipeline for status check")
	return ctrl.Result{RequeueAfter: 10 * time.Second}, nil
}

// pipelineState represents the current state of the pipeline
type pipelineState struct {
	allSucceeded              bool
	anyFailed                 bool
	anyRunning                bool
	anyPending                bool
	anySuspended              bool
	suspendedSteps            []string
	hasPendingFailureHandlers bool
}

// analyzePipelineState analyzes the current state of all steps
func (r *PipelineReconciler) analyzePipelineState(pipeline *pipelinev1.Pipeline) pipelineState {
	state := pipelineState{
		allSucceeded:   true,
		suspendedSteps: []string{},
	}

	succeededCount := 0
	skippedCount := 0
	failedCount := 0
	runningCount := 0
	pendingCount := 0
	suspendedCount := 0

	for _, stepStatus := range pipeline.Status.Steps {
		switch stepStatus.Phase {
		case pipelinev1.StepPhaseSucceeded:
			succeededCount++
		case pipelinev1.StepPhaseSkipped:
			skippedCount++
		case pipelinev1.StepPhaseFailed:
			failedCount++
			state.anyFailed = true
			state.allSucceeded = false
		case pipelinev1.StepPhaseRunning:
			runningCount++
			state.anyRunning = true
			state.allSucceeded = false
		case pipelinev1.StepPhasePending:
			pendingCount++
			state.anyPending = true
			state.allSucceeded = false
		case pipelinev1.StepPhaseSuspended:
			suspendedCount++
			state.anySuspended = true
			state.suspendedSteps = append(state.suspendedSteps, stepStatus.Name)
			state.allSucceeded = false
		}
	}

	// Check if there are any failure handlers that could still run
	if state.anyPending && state.anyFailed {
		state.hasPendingFailureHandlers = r.hasPendingFailureHandlers(pipeline)
	}

	return state
}

// updatePipelinePhase updates the pipeline phase based on current state
func (r *PipelineReconciler) updatePipelinePhase(ctx context.Context, pipeline *pipelinev1.Pipeline, state pipelineState) error {
	logger := log.FromContext(ctx)
	oldPhase := pipeline.Status.Phase

	// Determine new phase
	if state.anySuspended && !state.anyRunning {
		// Pipeline is suspended - a step is waiting to be resumed
		pipeline.Status.Phase = pipelinev1.PipelinePhaseSuspended
	} else if state.anyFailed && !state.anyRunning && !state.anySuspended && !state.hasPendingFailureHandlers {
		// Pipeline failed and no cleanup/failure handlers are pending
		pipeline.Status.Phase = pipelinev1.PipelinePhaseFailed
		if pipeline.Status.CompletionTime == nil {
			now := metav1.Now()
			pipeline.Status.CompletionTime = &now
		}
	} else if state.allSucceeded {
		// All steps completed successfully (or were skipped)
		pipeline.Status.Phase = pipelinev1.PipelinePhaseSucceeded
		if pipeline.Status.CompletionTime == nil {
			now := metav1.Now()
			pipeline.Status.CompletionTime = &now
		}
	} else if state.anyRunning || state.hasPendingFailureHandlers {
		pipeline.Status.Phase = pipelinev1.PipelinePhaseRunning
	}

	// Update conditions
	r.updateConditions(pipeline, state)

	// Update status if changed
	if oldPhase != pipeline.Status.Phase {
		logger.Info("Pipeline phase changed", "old", oldPhase, "new", pipeline.Status.Phase)
		if err := r.Status().Update(ctx, pipeline); err != nil {
			return err
		}
	}

	return nil
}

// initializeStepStatuses creates initial status entries for all steps
func (r *PipelineReconciler) initializeStepStatuses(ctx context.Context, pipeline *pipelinev1.Pipeline) error {
	logger := log.FromContext(ctx)

	for _, step := range pipeline.Spec.Steps {
		pipeline.Status.Steps = append(pipeline.Status.Steps, pipelinev1.StepStatus{
			Name:  step.Name,
			Phase: pipelinev1.StepPhasePending,
		})
		logger.V(1).Info("Initialized step status", "step", step.Name, "phase", "Pending")
	}

	if err := r.Status().Update(ctx, pipeline); err != nil {
		logger.Error(err, "Failed to update pipeline status during initialization")
		return err
	}

	logger.Info("Step statuses initialized", "count", len(pipeline.Status.Steps))
	return nil
}

// getStepStatus retrieves the status for a given step by name
func (r *PipelineReconciler) getStepStatus(pipeline *pipelinev1.Pipeline, stepName string) *pipelinev1.StepStatus {
	for i := range pipeline.Status.Steps {
		if pipeline.Status.Steps[i].Name == stepName {
			return &pipeline.Status.Steps[i]
		}
	}
	return nil
}
