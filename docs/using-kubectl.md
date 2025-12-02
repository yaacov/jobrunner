# Using kubectl in Pipeline Steps

Pipeline steps can interact with the Kubernetes API using kubectl or any Kubernetes client library.

## Overview

Kubernetes automatically mounts service account credentials in every pod, but the default service account has no permissions. To use kubectl, you need to:

1. **Create a ServiceAccount with RBAC permissions**
2. **Specify it in your Pipeline** using the `serviceAccountName` field
3. **Install kubectl** in your container (most images don't include it)

## Automatic Kubernetes Integration

When a pod runs with a service account, Kubernetes automatically provides:

```
/var/run/secrets/kubernetes.io/serviceaccount/
├── token          # JWT token for authentication
├── ca.crt         # CA certificate
└── namespace      # Current namespace
```

Plus environment variables:
- `KUBERNETES_SERVICE_HOST` - API server hostname
- `KUBERNETES_SERVICE_PORT` - API server port

kubectl automatically uses these for in-cluster authentication.

## Complete Example

See [config/samples/pipeline_v1_kubectl.yaml](../config/samples/pipeline_v1_kubectl.yaml) for a complete working example.

### Step 1: Create ServiceAccount and RBAC

```yaml
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: pipeline-kubectl
  namespace: default

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pipeline-kubectl
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch", "create", "delete"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pipeline-kubectl
  namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pipeline-kubectl
subjects:
- kind: ServiceAccount
  name: pipeline-kubectl
  namespace: default
```

### Step 2: Create Pipeline with ServiceAccount

```yaml
apiVersion: pipeline.yaacov.io/v1
kind: Pipeline
metadata:
  name: kubectl-example
spec:
  # Use the service account with RBAC permissions
  serviceAccountName: pipeline-kubectl
  
  # Use fedora image for all steps
  podTemplate:
    image: fedora:latest
  
  steps:
    - name: list-pods
      jobSpec:
        template:
          spec:
            containers:
              - name: main
                command: [bash, -c]
                args:
                  - |
                    # Install kubectl
                    dnf install -y kubectl
                    
                    # List pods
                    kubectl get pods
            restartPolicy: Never
    
    - name: create-configmap
      jobSpec:
        template:
          spec:
            containers:
              - name: main
                command: [bash, -c]
                args:
                  - |
                    dnf install -y kubectl
                    
                    kubectl create configmap my-config \
                      --from-literal=key=value
            restartPolicy: Never
```
