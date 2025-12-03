# Deployment

## Quick Install

Deploy directly from GitHub - no clone required (will use pre built image):

```bash
kubectl apply -f https://raw.githubusercontent.com/yaacov/jobrunner/main/dist/install.yaml
```

## Build Your Own Image

Build and push a custom image to your registry:

```bash
git clone https://github.com/yaacov/jobrunner.git
cd jobrunner

# Build and push your custom image
make docker-build docker-push IMG=your-registry.io/jobrunner:v1.0.0

# Deploy using your image
make deploy IMG=your-registry.io/jobrunner:v1.0.0
```

To generate a custom `install.yaml` for distribution:

```bash
# Generate dist/install.yaml with your image
make build-installer IMG=your-registry.io/jobrunner:v1.0.0
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

