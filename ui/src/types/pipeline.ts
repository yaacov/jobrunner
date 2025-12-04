/**
 * Pipeline CRD TypeScript definitions
 * Matches the Go types in api/v1/pipeline_types.go
 */

export interface Pipeline {
  apiVersion: 'pipeline.yaacov.io/v1';
  kind: 'Pipeline';
  metadata: ObjectMeta;
  spec: PipelineSpec;
  status?: PipelineStatus;
}

export interface PipelineList {
  apiVersion: string;
  kind: string;
  metadata: ListMeta;
  items: Pipeline[];
}

export interface ObjectMeta {
  name: string;
  namespace?: string;
  uid?: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  resourceVersion?: string;
}

export interface ListMeta {
  resourceVersion?: string;
  continue?: string;
}

// ============================================
// PipelineSpec
// ============================================

export interface PipelineSpec {
  /** List of steps/jobs to run */
  steps: PipelineStep[];

  /** Service account for all jobs (can be overridden per step) */
  serviceAccountName?: string;

  /** Shared volume mounted to all steps */
  sharedVolume?: SharedVolumeSpec;

  /** Common pod configuration applied to all steps */
  podTemplate?: PodTemplateDefaults;
}

export interface PipelineStep {
  /** Unique identifier for this step (1-63 chars, lowercase alphanumeric + hyphens) */
  name: string;

  /** Conditional execution - if not specified, runs sequentially */
  runIf?: RunIfCondition;

  /** Kubernetes Job specification */
  jobSpec: JobSpec;
}

export interface RunIfCondition {
  /** Whether to check for success or failure (default: success) */
  condition?: 'success' | 'fail';

  /** Whether ALL or ANY steps must meet condition (default: and) */
  operator?: 'and' | 'or';

  /** List of step names to check */
  steps: string[];
}

export interface SharedVolumeSpec {
  /** Volume name (default: workspace) */
  name?: string;

  /** Mount path in each step (default: /workspace) */
  mountPath?: string;

  /** PersistentVolumeClaim source */
  persistentVolumeClaim?: { claimName: string };

  /** EmptyDir source */
  emptyDir?: { medium?: string; sizeLimit?: string };

  /** ConfigMap source */
  configMap?: { name: string };

  /** Secret source */
  secret?: { secretName: string };
}

export interface PodTemplateDefaults {
  /** Default container image for steps */
  image?: string;

  /** Environment variables injected into all containers */
  env?: EnvVar[];

  /** Environment from ConfigMaps/Secrets */
  envFrom?: EnvFromSource[];

  /** Node selector for pod scheduling */
  nodeSelector?: Record<string, string>;

  /** Tolerations for pod scheduling */
  tolerations?: Toleration[];

  /** Affinity rules */
  affinity?: Affinity;

  /** Pod security context */
  securityContext?: PodSecurityContext;

  /** Image pull secrets */
  imagePullSecrets?: LocalObjectReference[];

  /** Priority class name */
  priorityClassName?: string;

  /** Runtime class name */
  runtimeClassName?: string;

  /** Custom scheduler name */
  schedulerName?: string;

  /** Labels added to all pods */
  labels?: Record<string, string>;

  /** Annotations added to all pods */
  annotations?: Record<string, string>;

  /** Default resource requirements */
  defaultResources?: ResourceRequirements;
}

// ============================================
// JobSpec (simplified Kubernetes Job)
// ============================================

export interface JobSpec {
  template: PodTemplateSpec;
  backoffLimit?: number;
  activeDeadlineSeconds?: number;
  ttlSecondsAfterFinished?: number;
  parallelism?: number;
  completions?: number;
}

export interface PodTemplateSpec {
  metadata?: ObjectMeta;
  spec: PodSpec;
}

export interface PodSpec {
  containers: Container[];
  initContainers?: Container[];
  restartPolicy: 'Never' | 'OnFailure' | 'Always';
  serviceAccountName?: string;
  nodeSelector?: Record<string, string>;
  tolerations?: Toleration[];
  affinity?: Affinity;
  volumes?: Volume[];
  securityContext?: PodSecurityContext;
}

export interface Container {
  name: string;
  image?: string;
  command?: string[];
  args?: string[];
  workingDir?: string;
  env?: EnvVar[];
  envFrom?: EnvFromSource[];
  resources?: ResourceRequirements;
  volumeMounts?: VolumeMount[];
  securityContext?: SecurityContext;
  ports?: ContainerPort[];
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: EnvVarSource;
}

export interface EnvVarSource {
  secretKeyRef?: SecretKeySelector;
  configMapKeyRef?: ConfigMapKeySelector;
  fieldRef?: ObjectFieldSelector;
}

export interface SecretKeySelector {
  name: string;
  key: string;
  optional?: boolean;
}

export interface ConfigMapKeySelector {
  name: string;
  key: string;
  optional?: boolean;
}

export interface ObjectFieldSelector {
  fieldPath: string;
  apiVersion?: string;
}

export interface EnvFromSource {
  prefix?: string;
  secretRef?: SecretEnvSource;
  configMapRef?: ConfigMapEnvSource;
}

export interface SecretEnvSource {
  name: string;
  optional?: boolean;
}

export interface ConfigMapEnvSource {
  name: string;
  optional?: boolean;
}

export interface ResourceRequirements {
  requests?: { cpu?: string; memory?: string; [key: string]: string | undefined };
  limits?: { cpu?: string; memory?: string; [key: string]: string | undefined };
}

export interface VolumeMount {
  name: string;
  mountPath: string;
  subPath?: string;
  readOnly?: boolean;
}

export interface Volume {
  name: string;
  persistentVolumeClaim?: { claimName: string };
  emptyDir?: { medium?: string; sizeLimit?: string };
  configMap?: { name: string; items?: KeyToPath[] };
  secret?: { secretName: string; items?: KeyToPath[] };
}

export interface KeyToPath {
  key: string;
  path: string;
  mode?: number;
}

export interface Toleration {
  key?: string;
  operator?: 'Exists' | 'Equal';
  value?: string;
  effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  tolerationSeconds?: number;
}

export interface Affinity {
  nodeAffinity?: NodeAffinity;
  podAffinity?: PodAffinity;
  podAntiAffinity?: PodAntiAffinity;
}

export interface NodeAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: NodeSelector;
  preferredDuringSchedulingIgnoredDuringExecution?: PreferredSchedulingTerm[];
}

export interface NodeSelector {
  nodeSelectorTerms: NodeSelectorTerm[];
}

export interface NodeSelectorTerm {
  matchExpressions?: NodeSelectorRequirement[];
  matchFields?: NodeSelectorRequirement[];
}

export interface NodeSelectorRequirement {
  key: string;
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
  values?: string[];
}

export interface PreferredSchedulingTerm {
  weight: number;
  preference: NodeSelectorTerm;
}

export interface PodAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
  preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}

export interface PodAntiAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
  preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}

export interface PodAffinityTerm {
  labelSelector?: LabelSelector;
  topologyKey: string;
  namespaces?: string[];
}

export interface WeightedPodAffinityTerm {
  weight: number;
  podAffinityTerm: PodAffinityTerm;
}

export interface LabelSelector {
  matchLabels?: Record<string, string>;
  matchExpressions?: LabelSelectorRequirement[];
}

export interface LabelSelectorRequirement {
  key: string;
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
  values?: string[];
}

export interface PodSecurityContext {
  runAsUser?: number;
  runAsGroup?: number;
  runAsNonRoot?: boolean;
  fsGroup?: number;
  supplementalGroups?: number[];
}

export interface SecurityContext {
  runAsUser?: number;
  runAsGroup?: number;
  runAsNonRoot?: boolean;
  readOnlyRootFilesystem?: boolean;
  allowPrivilegeEscalation?: boolean;
  privileged?: boolean;
  capabilities?: Capabilities;
}

export interface Capabilities {
  add?: string[];
  drop?: string[];
}

export interface LocalObjectReference {
  name: string;
}

export interface ContainerPort {
  name?: string;
  containerPort: number;
  protocol?: 'TCP' | 'UDP' | 'SCTP';
}

// ============================================
// PipelineStatus
// ============================================

export interface PipelineStatus {
  /** Current phase of the pipeline */
  phase: PipelinePhase;

  /** When the pipeline started */
  startTime?: string;

  /** When the pipeline completed */
  completionTime?: string;

  /** Status of each step */
  steps: StepStatus[];

  /** Kubernetes-style conditions */
  conditions?: Condition[];
}

export type PipelinePhase = 'Pending' | 'Running' | 'Suspended' | 'Succeeded' | 'Failed';

export type StepPhase = 'Pending' | 'Running' | 'Suspended' | 'Succeeded' | 'Failed' | 'Skipped';

export interface StepStatus {
  /** Step name */
  name: string;

  /** Current phase of the step */
  phase: StepPhase;

  /** Name of the Job created for this step */
  jobName?: string;

  /** Status from the underlying Kubernetes Job */
  jobStatus?: JobStatus;
}

export interface JobStatus {
  active?: number;
  succeeded?: number;
  failed?: number;
  startTime?: string;
  completionTime?: string;
  conditions?: JobCondition[];
}

export interface JobCondition {
  type: 'Complete' | 'Failed' | 'Suspended';
  status: 'True' | 'False' | 'Unknown';
  reason?: string;
  message?: string;
  lastProbeTime?: string;
  lastTransitionTime?: string;
}

export interface Condition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
  observedGeneration?: number;
}

// ============================================
// Helper Types for UI
// ============================================

/** Graph node for pipeline visualization */
export interface PipelineNode {
  id: string;
  type: 'step';
  data: {
    step: PipelineStep;
    status?: StepStatus;
  };
  position: { x: number; y: number };
}

/** Graph edge for pipeline visualization */
export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  type: 'sequential' | 'success' | 'failure';
  data?: {
    condition?: 'success' | 'fail';
    operator?: 'and' | 'or';
  };
}

/** Pipeline graph representation */
export interface PipelineGraph {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

// ============================================
// API Response Types
// ============================================

export interface WatchEvent<T> {
  type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR';
  object: T;
}

export interface ApiError {
  kind: 'Status';
  apiVersion: 'v1';
  metadata: Record<string, unknown>;
  status: 'Failure';
  message: string;
  reason: string;
  code: number;
}
