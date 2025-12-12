# JobRunner - Runs Kubernetes jobs sequentially

A job runner runs Kubernetes jobs sequentially. While Kubernetes provides Deployments, StatefulSets, DaemonSets, and more, it lacks a native resource for running jobs in sequence. JobRunner fills this gap with a simple Pipeline CRD.

<p align="center">
  <img src="docs/jobrunner.png" alt="JobRunner" width="400">
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
- You need conditional execution - run steps based on success or failure of others
- Steps need different container images or resource limits
- You need to retry individual steps on failure
- You want per-step logs and status
- Steps can run in parallel

Use a single Job when:
- Steps run sequentially and share state
- All steps use the same image
- Simplicity matters more than flexibility

## Quick Start

### Install CRDs and Run locally

```bash
# Install CRDs
make install

# Run operator locally
make run
```

### Deploy on cluster using pre built image

Deploy directly from GitHub - no clone required (will use pre built image):

```bash
kubectl apply -f https://raw.githubusercontent.com/yaacov/jobrunner/main/dist/install.yaml
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

## Web UI

JobRunner includes a web interface for managing pipelines, storage, and secrets. The UI provides:

- **Monitor**: Real-time pipeline status and logs
- **Builder**: Visual pipeline editor with drag-and-drop
- **Storage**: PVC management for shared volumes
- **Secrets**: Kubernetes secret management

### Quick Start (Container)

```bash
# Terminal 1: Start kubectl proxy
kubectl proxy --port=8001

# Terminal 2: Run the UI container (podman or docker)
podman run --rm --network=host quay.io/yaacov/jobrunner-ui:latest
```

Open http://localhost:8080

See the [UI documentation](docs/ui.md) for more details and development setup.

### UI Demo

https://github.com/yaacov/jobrunner/raw/main/docs/ui-demo.webm

## Documentation

For more detailed information, see the following guides:

- [Deployment](docs/deployment.md) - Install JobRunner on your cluster
- [Web UI](docs/ui.md) - Web interface for managing pipelines
- [Conditional Execution](docs/conditional-execution.md) - Control step execution based on conditions
- [Shared Volumes](docs/shared-volumes.md) - Share data between pipeline steps
- [Pod Templates](docs/pod-templates.md) - Define shared configuration for all steps
- [Job Controls](docs/job-controls.md) - Retry limits, timeouts, auto-cleanup, and suspend
- [Using kubectl](docs/using-kubectl.md) - Run kubectl commands in your pipeline steps

## License

Apache License 2.0
