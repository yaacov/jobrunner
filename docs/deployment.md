# Deployment

## Quick Install

```bash
# Clone the repo
git clone https://github.com/yaacov/jobrunner.git
cd jobrunner

# Build and push the image (requires access to registry)
make docker-build docker-push IMG=quay.io/yaacov/jobrunner:latest

# Deploy to cluster
make deploy IMG=quay.io/yaacov/jobrunner:latest
```

## Using a Pre-built Image

If an image is already published:

```bash
git clone https://github.com/yaacov/jobrunner.git
cd jobrunner
make deploy IMG=quay.io/yaacov/jobrunner:latest
```

## Uninstall

```bash
make undeploy
```

## What Gets Installed

| Resource | Name | Purpose |
|----------|------|---------|
| Namespace | `jobrunner-system` | Controller namespace |
| CRD | `pipelines.pipeline.yaacov.io` | Pipeline custom resource |
| Deployment | `jobrunner-controller-manager` | Pipeline controller |
| ServiceAccount | `jobrunner-controller-manager` | Controller identity |
| ClusterRole | `jobrunner-manager-role` | Permissions for Jobs, Pipelines |

## Verify Installation

```bash
# Check controller is running
kubectl get pods -n jobrunner-system

# Check CRD is installed
kubectl get crd pipelines.pipeline.yaacov.io

# Create a test pipeline
kubectl apply -f config/samples/pipeline_v1_cicd_simple.yaml
kubectl get pipeline -w
```

## Configuration

Resource limits (default):
- CPU: 10m request, 500m limit
- Memory: 64Mi request, 128Mi limit

