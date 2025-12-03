# Job Controls

Configure per-step retry limits, timeouts, automatic cleanup, and suspend/resume behavior.

## Overview

Each pipeline step creates a Kubernetes Job. You can configure Job-level settings in the `jobSpec` to control how each step handles failures, timeouts, and cleanup.

## Retry Limits

Control how many times a step retries on failure using `backoffLimit`:

```yaml
steps:
  - name: flaky-network-call
    jobSpec:
      backoffLimit: 3  # Retry up to 3 times before failing
      template:
        spec:
          containers:
            - name: main
              image: curlimages/curl
              command: ["curl", "--retry", "3", "https://api.example.com/webhook"]
          restartPolicy: Never
```

**Note:** JobRunner sets `backoffLimit: 0` by default (no retries). Set it explicitly if you want retries.

| Value | Behavior |
|-------|----------|
| `0` | No retries - fail immediately (JobRunner default) |
| `3` | Retry up to 3 times |
| `6` | Kubernetes default if not in a pipeline |

## Timeouts

Set a maximum duration for a step using `activeDeadlineSeconds`:

```yaml
steps:
  - name: long-running-task
    jobSpec:
      activeDeadlineSeconds: 300  # 5 minute timeout
      template:
        spec:
          containers:
            - name: main
              image: busybox
              command: ["sh", "-c", "sleep 600"]  # Would run 10 min, but times out at 5
          restartPolicy: Never
```

When the deadline is exceeded:
- The Job is marked as Failed with reason `DeadlineExceeded`
- The step phase becomes `Failed`
- Running pods are terminated
- The pipeline proceeds based on its conditional execution rules

## Auto-Cleanup

Automatically delete completed Jobs after a period using `ttlSecondsAfterFinished`:

```yaml
steps:
  - name: temporary-task
    jobSpec:
      ttlSecondsAfterFinished: 3600  # Delete job 1 hour after completion
      template:
        spec:
          containers:
            - name: main
              image: busybox
              command: ["echo", "done"]
          restartPolicy: Never
```

This helps keep your cluster clean without manual intervention.

| Value | Behavior |
|-------|----------|
| `0` | Delete immediately after completion |
| `3600` | Delete 1 hour after completion |
| `86400` | Delete 24 hours after completion |
| Not set | Job persists until manually deleted or pipeline deleted |

## Suspend and Resume

Suspend a step to create a manual gate or pause execution.

### Starting Suspended

Create a step that waits for manual approval:

```yaml
steps:
  - name: build
    jobSpec:
      template:
        spec:
          containers:
            - name: main
              image: busybox
              command: ["echo", "building"]
          restartPolicy: Never

  - name: deploy-approval
    jobSpec:
      suspend: true  # Starts suspended - requires manual resume
      template:
        spec:
          containers:
            - name: main
              image: busybox
              command: ["echo", "deploying to production"]
          restartPolicy: Never
```

When a step is suspended:
- The step phase shows as `Suspended`
- The pipeline phase shows as `Suspended`
- The Ready condition shows which steps are suspended

### Resuming a Suspended Step

Resume by patching the Job:

```bash
# Find the job name (format: <pipeline>-<step>)
kubectl get jobs -l pipeline.yaacov.io/pipeline=my-pipeline

# Resume the suspended job
kubectl patch job my-pipeline-deploy-approval -p '{"spec":{"suspend":false}}'
```

The pipeline automatically detects the change and continues.

### Suspending a Running Step

You can also suspend a step that's already running:

```bash
# Suspend a running job
kubectl patch job my-pipeline-long-task -p '{"spec":{"suspend":true}}'
```

When suspended mid-execution:
- Running pods continue to completion (they're not killed)
- No new pods are created
- The step enters `Suspended` state once active pods finish

## Pipeline Status

The pipeline status reflects step states:

```bash
$ kubectl get pipeline my-pipeline
NAME          PHASE       AGE
my-pipeline   Suspended   5m
```

Check which step is suspended:

```bash
$ kubectl get pipeline my-pipeline -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}'
Pipeline is suspended (suspended steps: [deploy-approval])
```

## Complete Example

A pipeline with all job controls:

```yaml
apiVersion: pipeline.yaacov.io/v1
kind: Pipeline
metadata:
  name: controlled-pipeline
spec:
  steps:
    - name: fetch-data
      jobSpec:
        backoffLimit: 5           # Retry network issues
        activeDeadlineSeconds: 60  # 1 minute timeout
        template:
          spec:
            containers:
              - name: main
                image: curlimages/curl
                command: ["curl", "-o", "/data/input.json", "https://api.example.com/data"]
            restartPolicy: Never

    - name: process
      jobSpec:
        backoffLimit: 0                  # No retries - fail fast
        activeDeadlineSeconds: 1800      # 30 minute timeout
        ttlSecondsAfterFinished: 3600    # Cleanup after 1 hour
        template:
          spec:
            containers:
              - name: main
                image: python:3.11
                command: ["python", "process.py"]
            restartPolicy: Never

    - name: deploy
      jobSpec:
        suspend: true   # Manual gate - requires approval
        backoffLimit: 2
        template:
          spec:
            containers:
              - name: main
                image: bitnami/kubectl
                command: ["kubectl", "apply", "-f", "manifests/"]
            restartPolicy: Never
```

## Quick Reference

| Field | Purpose | Default |
|-------|---------|---------|
| `backoffLimit` | Retry count before failure | `0` (JobRunner) |
| `activeDeadlineSeconds` | Maximum step duration | No limit |
| `ttlSecondsAfterFinished` | Auto-delete after completion | Never |
| `suspend` | Pause execution | `false` |

