# Conditional Execution

Use `runIf` to control when steps run based on other steps' success or failure.

## Basic Usage

```yaml
steps:
  - name: unit-test
    jobSpec: {...}
  
  - name: integration-test
    jobSpec: {...}
  
  # Run if ALL tests succeed (default: condition=success, operator=and)
  - name: deploy
    runIf:
      steps: [unit-test, integration-test]
    jobSpec: {...}
  
  # Run if ANY test fails
  - name: rollback
    runIf:
      condition: fail
      operator: or
      steps: [unit-test, integration-test]
    jobSpec: {...}
```

## Four Combinations

| `condition` | `operator` | Runs when... |
|-------------|------------|--------------|
| `success` (default) | `and` (default) | ALL steps succeeded |
| `success` | `or` | ANY step succeeded |
| `fail` | `and` | ALL steps failed |
| `fail` | `or` | ANY step failed |

## Important: Steps Run Only Once

Each step runs **at most once** per pipeline execution:
- Once a step starts running, it will never re-run, even if conditions remain satisfied
- With `operator: or`, a step runs as soon as **the first** condition is met
- Steps have one-way state transitions: `Pending` → `Running` → `Succeeded/Failed/Skipped`

### Example

```yaml
# publish runs as soon as EITHER build completes
- name: publish
  runIf:
    operator: or
    steps: [build-x86, build-arm]
```

- If `build-x86` finishes first → `publish` starts immediately
- When `build-arm` finishes later → `publish` keeps running (does NOT restart)

To run multiple steps independently, create separate steps:

```yaml
- name: publish-x86
  runIf:
    steps: [build-x86]

- name: publish-arm
  runIf:
    steps: [build-arm]
```

## Failure Handling

Run cleanup, notifications, or rollback steps when failures occur:

```yaml
steps:
  - name: deploy-production
    jobSpec: {...}
  
  - name: verify-deployment
    jobSpec: {...}
  
  # Rollback if deploy OR verify fails
  - name: rollback
    runIf:
      condition: fail
      operator: or
      steps: [deploy-production, verify-deployment]
    jobSpec: {...}
  
  # Notify team if anything fails
  - name: notify-failure
    runIf:
      condition: fail
      operator: or
      steps: [deploy-production, verify-deployment, rollback]
    jobSpec: {...}
```

## Mixed Sequential and Conditional Execution

Combine sequential steps with conditional logic for powerful workflows:

```yaml
spec:
  steps:
    # These run sequentially
    - name: checkout
      jobSpec: {...}
    
    - name: build
      jobSpec: {...}
    
    - name: unit-test
      jobSpec: {...}
    
    - name: integration-test
      jobSpec: {...}
    
    # This runs if ALL tests pass (out of order - doesn't wait for other steps)
    - name: deploy
      runIf:
        steps: [unit-test, integration-test]
      jobSpec: {...}
    
    # This runs if deploy fails (out of order)
    - name: rollback
      runIf:
        condition: fail
        steps: [deploy]
      jobSpec: {...}
    
    # This runs if ANY step fails (out of order)
    - name: notify
      runIf:
        condition: fail
        operator: or
        steps: [build, unit-test, integration-test, deploy]
      jobSpec: {...}
```

## Sequential Execution

By default, steps run **sequentially** without needing `runIf`:

```yaml
steps:
  - name: build      # Runs first
  - name: test       # Waits for build to succeed
  - name: deploy     # Waits for test to succeed
```

Each step waits for all previous steps to succeed. The pipeline stops if any step fails.

