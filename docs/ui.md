# Web UI

A web-based interface for managing JobRunner pipelines, storage, and secrets.

## Features

- **Monitor**: View all pipelines with real-time status updates, step progress, and logs
- **Builder**: Visual pipeline editor with drag-and-drop step management
- **Storage**: Create and manage PersistentVolumeClaims for shared volumes
- **Secrets**: Create and manage Kubernetes secrets for sensitive configuration

## Running the UI

### Development

```bash
cd ui
bun install
bun run dev
```

The UI runs on `http://localhost:3000` and proxies Kubernetes API requests.

### Production Build

```bash
cd ui
bun run build
```

Built files are output to `ui/dist/`.

## Connecting to Kubernetes

The UI connects to your Kubernetes cluster via `kubectl proxy`:

```bash
# Start kubectl proxy (required for the UI to communicate with the cluster)
kubectl proxy --port=8001

# In another terminal, start the UI
cd ui && bun run dev
```

## Pages

### Monitor

Lists all pipelines in the selected namespace. Click a pipeline to view:
- Step-by-step execution status
- Pod logs for each step
- Pipeline YAML

Actions: Copy pipeline to builder, delete pipeline.

### Builder

Create new pipelines or copy existing ones:
- Add steps (bash, python, kubectl, custom)
- Configure step commands, images, and environment variables
- Set dependencies between steps
- Configure global settings (shared volumes, pod templates)
- Mount secrets as environment variables

### Storage

Manage PersistentVolumeClaims:
- Create PVCs with custom size, access mode, and storage class
- View PVC status and capacity
- Delete unused PVCs

### Secrets

Manage Kubernetes Opaque secrets:
- Create secrets with key-value pairs
- View and edit existing secrets (values masked by default)
- Delete secrets

