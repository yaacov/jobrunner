# JobRunner - Runs Kubernetes jobs sequentially

A job runner runs Kubernetes jobs sequentially. While Kubernetes provides Deployments, StatefulSets, DaemonSets, and more, it lacks a native resource for running jobs in sequence. JobRunner fills this gap with a simple Pipeline CRD.

<p align="center">
  <img src="docs/jobrunner.jpg" alt="JobRunner" width="300">
</p>

## Overview

Kubernetes has a Job resource for running single workloads to completion, but no built-in way to run multiple jobs sequentially. JobRunner provides a declarative Pipeline resource that orchestrates Kubernetes Jobs with support for:

- **Sequential Execution**: Steps run in order by default - simple and predictable
- **Conditional Execution**: Control when steps run based on success or failure of other steps ([docs](docs/conditional-execution.md))
- **Shared Volumes**: Share data between steps with automatic directory setup ([docs](docs/shared-volumes.md))
- **Shared Configuration**: Define image, env vars, resources once - apply to all steps ([docs](docs/pod-templates.md))
- **Job Controls**: Per-step retry limits, timeouts, auto-cleanup, and suspend/resume ([docs](docs/job-controls.md))
- **In-cluster credentials**: Service account tokens and environment variables pre-configured ([docs](docs/using-kubectl.md))
- **Status Tracking**: Monitor pipeline and individual step progress

## Why Pipelines?

A pipeline breaks work into separate Jobs, giving each step its own container, resources, and lifecycle. This isolation lets you run steps in parallel, retry failures individually, and see exactly where things broke. The tradeoff is more moving parts than a single Job.

Use a pipeline when:
- Steps can run in parallel
- Steps need different container images or resource limits
- You need to retry individual steps on failure
- You want per-step logs and status

Use a single Job when:
- Steps run sequentially and share state
- All steps use the same image
- Simplicity matters more than flexibility

## Quick Start

### Install CRDs and Run Operator

```bash
# Install CRDs
make install

# Run operator locally
make run
```

### Create a Pipeline

```bash
# Apply a sample pipeline
kubectl apply -f config/samples/pipeline_v1_cicd_simple.yaml

# Watch the pipeline
kubectl get pipeline -w
```

## Simple Example

Steps run **sequentially** by default - each step waits for previous steps to succeed:

```yaml
apiVersion: pipeline.yaacov.io/v1
kind: Pipeline
metadata:
  name: my-pipeline
spec:
  steps:
    - name: build
      jobSpec:
        template:
          spec:
            containers:
              - name: builder
                image: busybox:latest
                command: ["sh", "-c", "echo 'Building...'"]
            restartPolicy: Never

    - name: test
      jobSpec:
        template:
          spec:
            containers:
              - name: tester
                image: busybox:latest
                command: ["sh", "-c", "echo 'Testing...'"]
            restartPolicy: Never

    - name: deploy
      jobSpec:
        template:
          spec:
            containers:
              - name: deployer
                image: busybox:latest
                command: ["sh", "-c", "echo 'Deploying...'"]
            restartPolicy: Never
```

## Documentation

For more detailed information, see the following guides:

- [Deployment](docs/deployment.md) - Install JobRunner on your cluster
- [Conditional Execution](docs/conditional-execution.md) - Control step execution based on conditions
- [Shared Volumes](docs/shared-volumes.md) - Share data between pipeline steps
- [Pod Templates](docs/pod-templates.md) - Define shared configuration for all steps
- [Job Controls](docs/job-controls.md) - Retry limits, timeouts, auto-cleanup, and suspend
- [Using kubectl](docs/using-kubectl.md) - Run kubectl commands in your pipeline steps

## License

Apache License 2.0
