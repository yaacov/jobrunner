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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"

	pipelinev1 "github.com/yaacov/jobrunner/api/v1"
)

const (
	pipelineFinalizer = "pipeline.yaacov.io/finalizer"
)

// PipelineReconciler reconciles a Pipeline object
type PipelineReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=pipeline.yaacov.io,resources=pipelines,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=pipeline.yaacov.io,resources=pipelines/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=pipeline.yaacov.io,resources=pipelines/finalizers,verbs=update
// +kubebuilder:rbac:groups=batch,resources=jobs,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=batch,resources=jobs/status,verbs=get
// +kubebuilder:rbac:groups="",resources=pods,verbs=get;list;watch

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
func (r *PipelineReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := log.FromContext(ctx)

	// Fetch the Pipeline instance
	pipeline := &pipelinev1.Pipeline{}
	if err := r.Get(ctx, req.NamespacedName, pipeline); err != nil {
		if apierrors.IsNotFound(err) {
			// Pipeline was deleted
			return ctrl.Result{}, nil
		}
		logger.Error(err, "unable to fetch Pipeline")
		return ctrl.Result{}, err
	}

	// Handle deletion
	if !pipeline.DeletionTimestamp.IsZero() {
		return r.reconcileDelete(ctx, pipeline)
	}

	// Add finalizer if not present
	if !controllerutil.ContainsFinalizer(pipeline, pipelineFinalizer) {
		controllerutil.AddFinalizer(pipeline, pipelineFinalizer)
		if err := r.Update(ctx, pipeline); err != nil {
			return ctrl.Result{}, err
		}
	}

	// Initialize status if needed
	if pipeline.Status.Phase == "" {
		pipeline.Status.Phase = pipelinev1.PipelinePhasePending
		pipeline.Status.StartTime = &metav1.Time{Time: time.Now()}
		if err := r.Status().Update(ctx, pipeline); err != nil {
			return ctrl.Result{}, err
		}
		return ctrl.Result{Requeue: true}, nil
	}

	// Skip reconciliation for completed pipelines
	if pipeline.Status.Phase == pipelinev1.PipelinePhaseSucceeded ||
		pipeline.Status.Phase == pipelinev1.PipelinePhaseFailed {
		logger.V(1).Info("Pipeline already completed, skipping reconciliation", "phase", pipeline.Status.Phase)
		return ctrl.Result{}, nil
	}

	// Reconcile the pipeline
	return r.reconcilePipeline(ctx, pipeline)
}

// SetupWithManager sets up the controller with the Manager.
func (r *PipelineReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&pipelinev1.Pipeline{}).
		Owns(&batchv1.Job{}).
		Complete(r)
}
