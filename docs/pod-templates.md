# Pod Templates

Define common pod configuration once and apply it to all pipeline steps.

## Overview

The `podTemplate` field allows you to specify common settings that are automatically applied to all steps, eliminating repetition and ensuring consistency.

## Basic Configuration

```yaml
spec:
  podTemplate:
    # Shared image for all containers (optional, can override per step)
    image: fedora:latest
    
    # Shared environment variables
    env:
      - name: ENVIRONMENT
        value: production
      - name: LOG_LEVEL
        value: info
    
    # Default resource limits
    defaultResources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
  
  steps:
    - name: build
      jobSpec:
        template:
          spec:
            containers:
              - name: main
                # Image inherited from podTemplate.image
                # Env vars inherited from podTemplate.env
                # Resources inherited from podTemplate.defaultResources
                command: [bash, -c, "echo Building in $ENVIRONMENT"]
            restartPolicy: Never
```

## Available Fields

### Image

Default image for all containers that don't specify one:

```yaml
podTemplate:
  image: fedora:latest
```

### Environment Variables

Environment variables applied to all containers:

```yaml
podTemplate:
  env:
    - name: REPO_URL
      value: "https://github.com/example/repo.git"
    - name: BRANCH
      value: "main"
  
  envFrom:
    - configMapRef:
        name: common-config
    - secretRef:
        name: common-secrets
```

### Default Resources

Resource limits applied to containers without explicit resources:

```yaml
podTemplate:
  defaultResources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
```

### Node Selector

Schedule pods on specific nodes:

```yaml
podTemplate:
  nodeSelector:
    disktype: ssd
    zone: us-west-1
```

### Affinity

Advanced scheduling constraints:

```yaml
podTemplate:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/arch
            operator: In
            values:
            - amd64
```

### Tolerations

Allow scheduling on tainted nodes:

```yaml
podTemplate:
  tolerations:
    - key: "dedicated"
      operator: "Equal"
      value: "pipeline"
      effect: "NoSchedule"
```

### Security Context

Pod-level security settings:

```yaml
podTemplate:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
```

### Image Pull Secrets

Credentials for pulling private images:

```yaml
podTemplate:
  imagePullSecrets:
    - name: regcred
    - name: another-registry-secret
```

### Priority Class

Pod priority for scheduling:

```yaml
podTemplate:
  priorityClassName: high-priority
```

### Runtime Class

Container runtime configuration:

```yaml
podTemplate:
  runtimeClassName: nvidia
```

### Scheduler Name

Custom scheduler:

```yaml
podTemplate:
  schedulerName: my-custom-scheduler
```

### Labels and Annotations

Labels and annotations for pod templates:

```yaml
podTemplate:
  labels:
    team: platform
    app: ci-pipeline
  
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
```

## Service Account

Specify a service account for all jobs (useful for kubectl access):

```yaml
spec:
  serviceAccountName: pipeline-sa
  
  podTemplate:
    image: fedora:latest
```

See [Using kubectl](using-kubectl.md) for details on using kubectl in pipeline steps.

## Overriding Defaults

Steps can override pod template defaults:

```yaml
spec:
  podTemplate:
    image: fedora:latest
    env:
      - name: ENV
        value: production
  
  steps:
    - name: build
      jobSpec:
        template:
          spec:
            containers:
              - name: main
                # Uses fedora:latest from podTemplate
                command: [bash, -c, "echo $ENV"]
            restartPolicy: Never
    
    - name: special-task
      jobSpec:
        template:
          spec:
            containers:
              - name: main
                image: alpine:latest  # Overrides podTemplate.image
                env:
                  - name: EXTRA_VAR
                    value: special
                # Still gets ENV=production from podTemplate
                command: [sh, -c, "echo $ENV $EXTRA_VAR"]
            restartPolicy: Never
```

## Complete Example

```yaml
apiVersion: pipeline.yaacov.io/v1
kind: Pipeline
metadata:
  name: full-pod-template-example
spec:
  serviceAccountName: pipeline-sa
  
  podTemplate:
    image: fedora:latest
    
    env:
      - name: ENVIRONMENT
        value: production
      - name: LOG_LEVEL
        value: info
    
    envFrom:
      - configMapRef:
          name: app-config
    
    defaultResources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
    
    nodeSelector:
      disktype: ssd
    
    tolerations:
      - key: "dedicated"
        operator: "Equal"
        value: "pipeline"
        effect: "NoSchedule"
    
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      fsGroup: 2000
    
    imagePullSecrets:
      - name: regcred
    
    labels:
      team: platform
    
    annotations:
      prometheus.io/scrape: "true"
  
  steps:
    - name: build
      jobSpec:
        template:
          spec:
            containers:
              - name: main
                command: [bash, -c, "make build"]
            restartPolicy: Never
```
