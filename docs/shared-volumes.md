# Shared Volumes

Share data between pipeline steps using shared volumes.

## Basic Configuration

First, create a PVC (or let the controller create one for you):

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pipeline-workspace
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  # No storageClassName specified - uses cluster default
```

Then reference it in your pipeline:

```yaml
spec:
  sharedVolume:
    name: workspace
    mountPath: /workspace
    persistentVolumeClaim:
      claimName: pipeline-workspace
  
  steps:
    - name: clone
      jobSpec:
        template:
          spec:
            containers:
              - name: main
                image: fedora:latest
                command: [bash, -c]
                args:
                  - |
                    git clone https://github.com/example/repo /workspace/repo
            restartPolicy: Never
    
    - name: build
      jobSpec:
        template:
          spec:
            containers:
              - name: main
                image: fedora:latest
                command: [bash, -c]
                args:
                  - |
                    cd /workspace/repo
                    make build
            restartPolicy: Never
```

The shared volume is mounted at the specified `mountPath` in all step containers. Data written by one step is accessible to subsequent steps.

## Example Volume Types

### PersistentVolumeClaim

Use PVCs to share data between steps. If you don't specify a `storageClassName`, Kubernetes will use the cluster's default StorageClass:

```yaml
# Create a PVC first
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-workspace
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
---
# Reference it in your pipeline
spec:
  sharedVolume:
    name: workspace
    mountPath: /workspace
    persistentVolumeClaim:
      claimName: my-workspace
```

### EmptyDir - **Does NOT work for data sharing**

**NOTE: Cannot be used to share data between steps** - Each job pod gets its own emptyDir that is deleted when the pod terminates:

```yaml
# This will NOT work for sharing data between steps!
sharedVolume:
  name: workspace
  mountPath: /workspace
  emptyDir: {}
```

EmptyDir can only be used if you need a scratch space **within a single step** (not between steps).

### ConfigMap (Read-Only Configuration)

For sharing read-only configuration files:

```yaml
sharedVolume:
  name: config
  mountPath: /config
  configMap:
    name: my-config
```
