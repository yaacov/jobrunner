/**
 * Kubernetes API Client for Pipeline CRD
 * Communicates with the Kubernetes API server via proxy
 */

import type { Pipeline, PipelineList, WatchEvent, ApiError } from '../types/pipeline.js';

export class K8sClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make an API request with error handling
   */
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const error: ApiError = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = (await response.text()) || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * List all pipelines in a namespace (or all namespaces)
   */
  async listPipelines(namespace = 'default'): Promise<Pipeline[]> {
    const path =
      namespace === '_all'
        ? '/apis/pipeline.yaacov.io/v1/pipelines'
        : `/apis/pipeline.yaacov.io/v1/namespaces/${namespace}/pipelines`;

    const result = await this.request<PipelineList>(path);
    return result.items || [];
  }

  /**
   * Get a specific pipeline
   */
  async getPipeline(namespace: string, name: string): Promise<Pipeline> {
    return this.request<Pipeline>(
      `/apis/pipeline.yaacov.io/v1/namespaces/${namespace}/pipelines/${name}`
    );
  }

  /**
   * Create a new pipeline
   */
  async createPipeline(namespace: string, pipeline: Pipeline): Promise<Pipeline> {
    return this.request<Pipeline>(`/apis/pipeline.yaacov.io/v1/namespaces/${namespace}/pipelines`, {
      method: 'POST',
      body: JSON.stringify(pipeline),
    });
  }

  /**
   * Update an existing pipeline
   */
  async updatePipeline(namespace: string, name: string, pipeline: Pipeline): Promise<Pipeline> {
    return this.request<Pipeline>(
      `/apis/pipeline.yaacov.io/v1/namespaces/${namespace}/pipelines/${name}`,
      {
        method: 'PUT',
        body: JSON.stringify(pipeline),
      }
    );
  }

  /**
   * Delete a pipeline
   */
  async deletePipeline(namespace: string, name: string): Promise<void> {
    await this.request(`/apis/pipeline.yaacov.io/v1/namespaces/${namespace}/pipelines/${name}`, {
      method: 'DELETE',
    });
  }

  /**
   * Watch pipelines for real-time updates
   */
  watchPipelines(
    namespace: string,
    callback: (event: WatchEvent<Pipeline>) => void,
    resourceVersion?: string
  ): () => void {
    const path =
      namespace === '_all'
        ? '/apis/pipeline.yaacov.io/v1/pipelines'
        : `/apis/pipeline.yaacov.io/v1/namespaces/${namespace}/pipelines`;

    const params = new URLSearchParams({ watch: 'true' });
    if (resourceVersion) {
      params.set('resourceVersion', resourceVersion);
    }

    const abortController = new AbortController();

    const startWatch = async () => {
      try {
        const response = await fetch(`${this.baseUrl}${path}?${params}`, {
          signal: abortController.signal,
        });

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const event: WatchEvent<Pipeline> = JSON.parse(line);
                callback(event);
              } catch (e) {
                console.error('Failed to parse watch event:', e);
              }
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('Watch error:', e);
          // Retry after a delay
          setTimeout(startWatch, 5000);
        }
      }
    };

    startWatch();

    return () => abortController.abort();
  }

  /**
   * Get pod logs for a step
   */
  async getPodLogs(
    namespace: string,
    podName: string,
    options: {
      container?: string;
      follow?: boolean;
      tailLines?: number;
      sinceSeconds?: number;
    } = {}
  ): Promise<string> {
    const params = new URLSearchParams();
    if (options.container) params.set('container', options.container);
    if (options.follow) params.set('follow', 'true');
    if (options.tailLines) params.set('tailLines', String(options.tailLines));
    if (options.sinceSeconds) params.set('sinceSeconds', String(options.sinceSeconds));

    const response = await fetch(
      `${this.baseUrl}/api/v1/namespaces/${namespace}/pods/${podName}/log?${params}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get logs: ${response.status}`);
    }

    return response.text();
  }

  /**
   * Stream pod logs
   */
  streamPodLogs(
    namespace: string,
    podName: string,
    callback: (line: string) => void,
    options: { container?: string; tailLines?: number } = {}
  ): () => void {
    const params = new URLSearchParams({ follow: 'true' });
    if (options.container) params.set('container', options.container);
    if (options.tailLines) params.set('tailLines', String(options.tailLines));

    const abortController = new AbortController();

    const startStream = async () => {
      try {
        const response = await fetch(
          `${this.baseUrl}/api/v1/namespaces/${namespace}/pods/${podName}/log?${params}`,
          { signal: abortController.signal }
        );

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          for (const line of lines) {
            if (line) callback(line);
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('Log stream error:', e);
        }
      }
    };

    startStream();

    return () => abortController.abort();
  }

  /**
   * Get events for a resource
   */
  async getEvents(
    namespace: string,
    fieldSelector: string
  ): Promise<
    Array<{
      type: string;
      reason: string;
      message: string;
      firstTimestamp: string;
      lastTimestamp: string;
      count: number;
    }>
  > {
    const params = new URLSearchParams({ fieldSelector });
    const result = await this.request<{
      items: Array<{
        type: string;
        reason: string;
        message: string;
        firstTimestamp: string;
        lastTimestamp: string;
        count: number;
      }>;
    }>(`/api/v1/namespaces/${namespace}/events?${params}`);
    return result.items || [];
  }

  /**
   * List available namespaces
   */
  async listNamespaces(): Promise<string[]> {
    try {
      const result = await this.request<{ items: Array<{ metadata: { name: string } }> }>(
        '/api/v1/namespaces'
      );
      return result.items.map(ns => ns.metadata.name);
    } catch {
      // If we can't list namespaces, return default
      return ['default'];
    }
  }

  /**
   * Get a Job by name
   */
  async getJob(
    namespace: string,
    name: string
  ): Promise<{
    metadata: { name: string; namespace: string };
    spec: Record<string, unknown>;
    status: Record<string, unknown>;
  }> {
    return this.request(`/apis/batch/v1/namespaces/${namespace}/jobs/${name}`);
  }

  /**
   * Get a Pod by name
   */
  async getPod(
    namespace: string,
    name: string
  ): Promise<{
    metadata: { name: string; namespace: string };
    spec: Record<string, unknown>;
    status: Record<string, unknown>;
  }> {
    return this.request(`/api/v1/namespaces/${namespace}/pods/${name}`);
  }

  /**
   * List pods by label selector
   */
  async listPods(
    namespace: string,
    labelSelector: string
  ): Promise<
    Array<{
      metadata: { name: string; namespace: string };
      status: { phase: string };
    }>
  > {
    const params = new URLSearchParams({ labelSelector });
    const result = await this.request<{
      items: Array<{
        metadata: { name: string; namespace: string };
        status: { phase: string };
      }>;
    }>(`/api/v1/namespaces/${namespace}/pods?${params}`);
    return result.items || [];
  }

  /**
   * List PersistentVolumeClaims in a namespace
   */
  async listPVCs(namespace: string): Promise<
    Array<{
      metadata: { name: string; namespace: string; creationTimestamp?: string };
      spec: {
        accessModes?: string[];
        storageClassName?: string;
        volumeMode?: string;
        resources?: { requests?: { storage?: string } };
      };
      status: { phase: string };
    }>
  > {
    try {
      const result = await this.request<{
        items: Array<{
          metadata: { name: string; namespace: string; creationTimestamp?: string };
          spec: {
            accessModes?: string[];
            storageClassName?: string;
            volumeMode?: string;
            resources?: { requests?: { storage?: string } };
          };
          status: { phase: string };
        }>;
      }>(`/api/v1/namespaces/${namespace}/persistentvolumeclaims`);
      return result.items || [];
    } catch {
      // If we can't list PVCs, return empty array
      return [];
    }
  }

  /**
   * Create a PersistentVolumeClaim
   */
  async createPVC(
    namespace: string,
    pvc: {
      name: string;
      storageClassName?: string;
      accessModes: string[];
      volumeMode: string;
      storage: string;
    }
  ): Promise<void> {
    await this.request(`/api/v1/namespaces/${namespace}/persistentvolumeclaims`, {
      method: 'POST',
      body: JSON.stringify({
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
          name: pvc.name,
          namespace: namespace,
        },
        spec: {
          accessModes: pvc.accessModes,
          volumeMode: pvc.volumeMode,
          storageClassName: pvc.storageClassName || undefined,
          resources: {
            requests: {
              storage: pvc.storage,
            },
          },
        },
      }),
    });
  }

  /**
   * Delete a PersistentVolumeClaim
   */
  async deletePVC(namespace: string, name: string): Promise<void> {
    await this.request(`/api/v1/namespaces/${namespace}/persistentvolumeclaims/${name}`, {
      method: 'DELETE',
    });
  }

  /**
   * List StorageClasses
   */
  async listStorageClasses(): Promise<
    Array<{
      metadata: { name: string };
      provisioner: string;
      reclaimPolicy?: string;
      volumeBindingMode?: string;
      allowVolumeExpansion?: boolean;
    }>
  > {
    try {
      const result = await this.request<{
        items: Array<{
          metadata: { name: string };
          provisioner: string;
          reclaimPolicy?: string;
          volumeBindingMode?: string;
          allowVolumeExpansion?: boolean;
        }>;
      }>('/apis/storage.k8s.io/v1/storageclasses');
      return result.items || [];
    } catch {
      return [];
    }
  }

  /**
   * List Secrets in a namespace
   */
  async listSecrets(namespace: string): Promise<
    Array<{
      metadata: { name: string; namespace: string; creationTimestamp?: string };
      type: string;
      data?: Record<string, string>;
    }>
  > {
    try {
      const result = await this.request<{
        items: Array<{
          metadata: { name: string; namespace: string; creationTimestamp?: string };
          type: string;
          data?: Record<string, string>;
        }>;
      }>(`/api/v1/namespaces/${namespace}/secrets`);
      return result.items || [];
    } catch {
      return [];
    }
  }

  /**
   * Get a single Secret
   */
  async getSecret(
    namespace: string,
    name: string
  ): Promise<{
    metadata: { name: string; namespace: string; creationTimestamp?: string };
    type: string;
    data?: Record<string, string>;
  }> {
    return this.request(`/api/v1/namespaces/${namespace}/secrets/${name}`);
  }

  /**
   * Create an Opaque Secret
   */
  async createSecret(
    namespace: string,
    secret: {
      name: string;
      data: Record<string, string>;
    }
  ): Promise<void> {
    // Base64 encode all values
    const encodedData: Record<string, string> = {};
    for (const [key, value] of Object.entries(secret.data)) {
      encodedData[key] = btoa(value);
    }

    await this.request(`/api/v1/namespaces/${namespace}/secrets`, {
      method: 'POST',
      body: JSON.stringify({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: secret.name,
          namespace: namespace,
        },
        type: 'Opaque',
        data: encodedData,
      }),
    });
  }

  /**
   * Delete a Secret
   */
  async deleteSecret(namespace: string, name: string): Promise<void> {
    await this.request(`/api/v1/namespaces/${namespace}/secrets/${name}`, { method: 'DELETE' });
  }

  /**
   * Update an Opaque Secret
   */
  async updateSecret(namespace: string, name: string, data: Record<string, string>): Promise<void> {
    // Base64 encode all values
    const encodedData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      encodedData[key] = btoa(value);
    }

    await this.request(`/api/v1/namespaces/${namespace}/secrets/${name}`, {
      method: 'PUT',
      body: JSON.stringify({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: name,
          namespace: namespace,
        },
        type: 'Opaque',
        data: encodedData,
      }),
    });
  }
}

// Singleton instance
export const k8sClient = new K8sClient();
