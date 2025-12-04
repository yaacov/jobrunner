/**
 * Global Settings - Pipeline-wide configuration
 * Following RHDS tab and form patterns
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Pipeline, EnvVar } from '../../types/pipeline.js';
import { k8sClient } from '../../lib/k8s-client.js';

interface PVCInfo {
  name: string;
  storage?: string;
  phase: string;
}

@customElement('global-settings')
export class GlobalSettings extends LitElement {
  @property({ type: Object }) pipeline?: Pipeline;

  @state() private activeTab = 0;
  @state() private availablePVCs: PVCInfo[] = [];
  @state() private loadingPVCs = false;

  static styles = css`
    :host {
      display: block;
    }

    .tabs {
      display: flex;
      gap: var(--rh-space-xs, 4px);
      margin-block-end: var(--rh-space-lg, 24px);
      border-block-end: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .tab {
      padding: var(--rh-space-sm, 8px) var(--rh-space-md, 16px);
      background: none;
      border: none;
      border-block-end: 2px solid transparent;
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      cursor: pointer;
      transition: all 150ms ease;
    }

    .tab:hover {
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .tab:focus-visible {
      outline: var(--rh-border-width-md, 2px) solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: -2px;
    }

    .tab.active {
      color: var(--rh-color-interactive-blue-darker, #0066cc);
      border-block-end-color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .form-group {
      margin-block-end: var(--rh-space-md, 16px);
    }

    label {
      display: block;
      margin-block-end: var(--rh-space-xs, 4px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .label-hint {
      font-weight: normal;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
    }

    input[type='text'],
    input[type='number'],
    select {
      width: 100%;
      padding: var(--rh-space-sm, 8px);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      transition: border-color 150ms ease;
    }

    input:focus,
    select:focus {
      outline: none;
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      box-shadow: 0 0 0 1px var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
      margin-block-end: var(--rh-space-md, 16px);
    }

    .checkbox-row input {
      width: auto;
    }

    .checkbox-row label {
      margin: 0;
      font-weight: normal;
    }

    .env-list {
      display: flex;
      flex-direction: column;
      gap: var(--rh-space-sm, 8px);
    }

    .env-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: var(--rh-space-sm, 8px);
      align-items: start;
    }

    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--rh-space-sm, 8px);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      background: var(--rh-color-surface-lightest, #ffffff);
      cursor: pointer;
      transition: all 150ms ease;
    }

    .icon-btn:hover {
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .icon-btn:focus-visible {
      outline: var(--rh-border-width-md, 2px) solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 2px;
    }

    .icon-btn.danger:hover {
      background: var(--rh-color-red-100, #fce8e6);
      border-color: var(--rh-color-red-500, #c9190b);
      color: var(--rh-color-red-700, #a30d05);
    }

    .icon-btn rh-icon {
      --rh-icon-size: 16px;
    }

    .section-info {
      padding: var(--rh-space-md, 16px);
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      margin-block-end: var(--rh-space-lg, 24px);
    }

    .section-info rh-icon {
      --rh-icon-size: 16px;
      vertical-align: middle;
      margin-inline-end: var(--rh-space-xs, 4px);
    }

    .pvc-selector-row {
      display: flex;
      gap: var(--rh-space-sm, 8px);
      align-items: stretch;
    }

    .pvc-selector-row select,
    .pvc-selector-row input {
      flex: 1;
    }

    .pvc-selector-row .icon-btn {
      flex-shrink: 0;
    }

    .pvc-selector-row .icon-btn.loading {
      opacity: 0.6;
      pointer-events: none;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .pvc-selector-row .icon-btn.loading rh-icon {
      animation: spin 1s linear infinite;
    }
  `;

  private lastFetchedNamespace = '';

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    // Fetch PVCs when switching to volume tab or when namespace changes
    const namespace = this.pipeline?.metadata.namespace || 'default';
    if (this.activeTab === 2 && namespace !== this.lastFetchedNamespace) {
      this.fetchPVCs(namespace);
    }
  }

  private async fetchPVCs(namespace: string) {
    this.loadingPVCs = true;
    this.lastFetchedNamespace = namespace;
    try {
      const pvcs = await k8sClient.listPVCs(namespace);
      this.availablePVCs = pvcs.map(pvc => ({
        name: pvc.metadata.name,
        storage: pvc.spec.resources?.requests?.storage,
        phase: pvc.status.phase,
      }));
    } catch (error) {
      console.error('Failed to fetch PVCs:', error);
      this.availablePVCs = [];
    } finally {
      this.loadingPVCs = false;
    }
  }

  private dispatchUpdate() {
    this.dispatchEvent(
      new CustomEvent('update', {
        detail: { pipeline: this.pipeline },
      })
    );
  }

  private updateSpec(field: string, value: unknown) {
    if (!this.pipeline) return;

    this.pipeline = {
      ...this.pipeline,
      spec: {
        ...this.pipeline.spec,
        [field]: value,
      },
    };
    this.dispatchUpdate();
    this.requestUpdate();
  }

  private updatePodTemplate(field: string, value: unknown) {
    if (!this.pipeline) return;

    this.pipeline = {
      ...this.pipeline,
      spec: {
        ...this.pipeline.spec,
        podTemplate: {
          ...this.pipeline.spec.podTemplate,
          [field]: value || undefined,
        },
      },
    };
    this.dispatchUpdate();
    this.requestUpdate();
  }

  private updateSharedVolume(field: string, value: unknown) {
    if (!this.pipeline) return;

    const currentVolume = this.pipeline.spec.sharedVolume || {};

    this.pipeline = {
      ...this.pipeline,
      spec: {
        ...this.pipeline.spec,
        sharedVolume: {
          ...currentVolume,
          [field]: value,
        },
      },
    };
    this.dispatchUpdate();
    this.requestUpdate();
  }

  private toggleSharedVolume(enabled: boolean) {
    if (!this.pipeline) return;

    if (enabled) {
      this.updateSpec('sharedVolume', {
        name: 'workspace',
        mountPath: '/workspace',
        emptyDir: {},
      });
    } else {
      this.updateSpec('sharedVolume', undefined);
    }
  }

  private getEnvVars(): EnvVar[] {
    return this.pipeline?.spec.podTemplate?.env || [];
  }

  private updateEnvVars(envVars: EnvVar[]) {
    this.updatePodTemplate('env', envVars.length > 0 ? envVars : undefined);
  }

  private addEnvVar() {
    const envVars = [...this.getEnvVars(), { name: '', value: '' }];
    this.updateEnvVars(envVars);
  }

  private removeEnvVar(index: number) {
    const envVars = this.getEnvVars().filter((_, i) => i !== index);
    this.updateEnvVars(envVars);
  }

  private updateEnvVar(index: number, field: 'name' | 'value', value: string) {
    const envVars = this.getEnvVars().map((env, i) =>
      i === index ? { ...env, [field]: value } : env
    );
    this.updateEnvVars(envVars);
  }

  render() {
    if (!this.pipeline) {
      return html`<p>No pipeline</p>`;
    }

    return html`
      <nav class="tabs" role="tablist">
        <button
          class="tab ${this.activeTab === 0 ? 'active' : ''}"
          role="tab"
          aria-selected=${this.activeTab === 0}
          @click=${() => (this.activeTab = 0)}
        >
          General
        </button>
        <button
          class="tab ${this.activeTab === 1 ? 'active' : ''}"
          role="tab"
          aria-selected=${this.activeTab === 1}
          @click=${() => (this.activeTab = 1)}
        >
          Pod Template
        </button>
        <button
          class="tab ${this.activeTab === 2 ? 'active' : ''}"
          role="tab"
          aria-selected=${this.activeTab === 2}
          @click=${() => (this.activeTab = 2)}
        >
          Shared Volume
        </button>
        <button
          class="tab ${this.activeTab === 3 ? 'active' : ''}"
          role="tab"
          aria-selected=${this.activeTab === 3}
          @click=${() => (this.activeTab = 3)}
        >
          Environment
        </button>
      </nav>

      <div role="tabpanel">${this.renderTabContent()}</div>
    `;
  }

  private renderTabContent() {
    switch (this.activeTab) {
      case 0:
        return this.renderGeneralTab();
      case 1:
        return this.renderPodTab();
      case 2:
        return this.renderVolumeTab();
      case 3:
        return this.renderEnvTab();
    }
  }

  private renderGeneralTab() {
    return html`
      <div class="section-info">
        <rh-icon set="ui" icon="info-circle"></rh-icon>
        Configure general pipeline settings that apply to all steps.
      </div>

      <div class="form-group">
        <label for="namespace">Namespace</label>
        <input
          type="text"
          id="namespace"
          .value=${this.pipeline?.metadata.namespace || 'default'}
          @input=${(e: Event) => {
            if (this.pipeline) {
              this.pipeline = {
                ...this.pipeline,
                metadata: {
                  ...this.pipeline.metadata,
                  namespace: (e.target as HTMLInputElement).value,
                },
              };
              this.dispatchUpdate();
            }
          }}
        />
      </div>

      <div class="form-group">
        <label for="service-account">
          Service Account
          <span class="label-hint">(optional)</span>
        </label>
        <input
          type="text"
          id="service-account"
          .value=${this.pipeline?.spec.serviceAccountName || ''}
          placeholder="default"
          @input=${(e: Event) => {
            const value = (e.target as HTMLInputElement).value;
            this.updateSpec('serviceAccountName', value || undefined);
          }}
        />
      </div>
    `;
  }

  private renderPodTab() {
    const podTemplate = this.pipeline?.spec.podTemplate;

    return html`
      <div class="section-info">
        <rh-icon set="ui" icon="info-circle"></rh-icon>
        Default pod settings applied to all steps unless overridden.
      </div>

      <div class="form-group">
        <label for="default-image">
          Default Image
          <span class="label-hint">(used when step doesn't specify one)</span>
        </label>
        <input
          type="text"
          id="default-image"
          .value=${podTemplate?.image || ''}
          placeholder="e.g., registry.access.redhat.com/ubi9/ubi-minimal:latest"
          @input=${(e: Event) => {
            this.updatePodTemplate('image', (e.target as HTMLInputElement).value);
          }}
        />
      </div>

      <div class="form-group">
        <label for="priority-class">
          Priority Class
          <span class="label-hint">(optional)</span>
        </label>
        <input
          type="text"
          id="priority-class"
          .value=${podTemplate?.priorityClassName || ''}
          placeholder="e.g., high-priority"
          @input=${(e: Event) => {
            this.updatePodTemplate('priorityClassName', (e.target as HTMLInputElement).value);
          }}
        />
      </div>

      <div class="form-group">
        <label for="scheduler">
          Scheduler Name
          <span class="label-hint">(optional)</span>
        </label>
        <input
          type="text"
          id="scheduler"
          .value=${podTemplate?.schedulerName || ''}
          placeholder="default-scheduler"
          @input=${(e: Event) => {
            this.updatePodTemplate('schedulerName', (e.target as HTMLInputElement).value);
          }}
        />
      </div>
    `;
  }

  private renderVolumeTab() {
    const sharedVolume = this.pipeline?.spec.sharedVolume;
    const hasVolume = !!sharedVolume;

    return html`
      <div class="section-info">
        <rh-icon set="ui" icon="info-circle"></rh-icon>
        A shared volume is mounted to all steps, allowing them to share files.
      </div>

      <div class="checkbox-row">
        <input
          type="checkbox"
          id="enable-volume"
          ?checked=${hasVolume}
          @change=${(e: Event) => {
            this.toggleSharedVolume((e.target as HTMLInputElement).checked);
          }}
        />
        <label for="enable-volume">Enable shared volume</label>
      </div>

      ${hasVolume
        ? html`
            <div class="form-group">
              <label for="volume-name">Volume Name</label>
              <input
                type="text"
                id="volume-name"
                .value=${sharedVolume?.name || 'workspace'}
                @input=${(e: Event) => {
                  this.updateSharedVolume('name', (e.target as HTMLInputElement).value);
                }}
              />
            </div>

            <div class="form-group">
              <label for="mount-path">Mount Path</label>
              <input
                type="text"
                id="mount-path"
                .value=${sharedVolume?.mountPath || '/workspace'}
                @input=${(e: Event) => {
                  this.updateSharedVolume('mountPath', (e.target as HTMLInputElement).value);
                }}
              />
            </div>

            <div class="form-group">
              <label for="volume-type">Volume Type</label>
              <select
                id="volume-type"
                @change=${(e: Event) => {
                  const type = (e.target as HTMLSelectElement).value;
                  if (type === 'emptyDir') {
                    this.updateSharedVolume('emptyDir', {});
                    this.updateSharedVolume('persistentVolumeClaim', undefined);
                  } else {
                    this.updateSharedVolume('emptyDir', undefined);
                    this.updateSharedVolume('persistentVolumeClaim', { claimName: '' });
                  }
                }}
              >
                <option value="emptyDir" ?selected=${!!sharedVolume?.emptyDir}>
                  EmptyDir (temporary)
                </option>
                <option value="pvc" ?selected=${!!sharedVolume?.persistentVolumeClaim}>
                  PersistentVolumeClaim
                </option>
              </select>
            </div>

            ${sharedVolume?.persistentVolumeClaim !== undefined
              ? html`
                  <div class="form-group">
                    <label for="pvc-name">PVC Name</label>
                    <div class="pvc-selector-row">
                      ${this.loadingPVCs
                        ? html`
                            <select id="pvc-name" disabled>
                              <option>Loading PVCs...</option>
                            </select>
                          `
                        : this.availablePVCs.length > 0
                          ? html`
                              <select
                                id="pvc-name"
                                @change=${(e: Event) => {
                                  this.updateSharedVolume('persistentVolumeClaim', {
                                    claimName: (e.target as HTMLSelectElement).value,
                                  });
                                }}
                              >
                                <option
                                  value=""
                                  ?selected=${!sharedVolume.persistentVolumeClaim?.claimName}
                                >
                                  -- Select a PVC --
                                </option>
                                ${this.availablePVCs.map(
                                  pvc => html`
                                    <option
                                      value=${pvc.name}
                                      ?selected=${sharedVolume.persistentVolumeClaim?.claimName ===
                                      pvc.name}
                                    >
                                      ${pvc.name}${pvc.storage
                                        ? ` (${pvc.storage})`
                                        : ''}${pvc.phase !== 'Bound' ? ` [${pvc.phase}]` : ''}
                                    </option>
                                  `
                                )}
                              </select>
                            `
                          : html`
                              <input
                                type="text"
                                id="pvc-name"
                                .value=${sharedVolume.persistentVolumeClaim?.claimName || ''}
                                placeholder="No PVCs found - enter name manually"
                                @input=${(e: Event) => {
                                  this.updateSharedVolume('persistentVolumeClaim', {
                                    claimName: (e.target as HTMLInputElement).value,
                                  });
                                }}
                              />
                            `}
                      <button
                        class="icon-btn ${this.loadingPVCs ? 'loading' : ''}"
                        @click=${() =>
                          this.fetchPVCs(this.pipeline?.metadata.namespace || 'default')}
                        title="Refresh PVC list"
                        aria-label="Refresh PVC list"
                        ?disabled=${this.loadingPVCs}
                      >
                        <rh-icon set="ui" icon="sync"></rh-icon>
                      </button>
                    </div>
                  </div>
                `
              : ''}
          `
        : ''}
    `;
  }

  private renderEnvTab() {
    const envVars = this.getEnvVars();

    return html`
      <div class="section-info">
        <rh-icon set="ui" icon="info-circle"></rh-icon>
        Environment variables injected into all step containers.
      </div>

      <div class="env-list">
        ${envVars.map(
          (env, index) => html`
            <div class="env-row">
              <input
                type="text"
                placeholder="Name"
                .value=${env.name}
                @input=${(e: Event) =>
                  this.updateEnvVar(index, 'name', (e.target as HTMLInputElement).value)}
                aria-label="Variable name"
              />
              <input
                type="text"
                placeholder="Value"
                .value=${env.value || ''}
                @input=${(e: Event) =>
                  this.updateEnvVar(index, 'value', (e.target as HTMLInputElement).value)}
                aria-label="Variable value"
              />
              <button
                class="icon-btn danger"
                @click=${() => this.removeEnvVar(index)}
                title="Remove variable"
                aria-label="Remove variable"
              >
                <rh-icon set="ui" icon="trash"></rh-icon>
              </button>
            </div>
          `
        )}
        <rh-button variant="secondary" @click=${this.addEnvVar}>
          <rh-icon set="ui" icon="add-circle" slot="icon"></rh-icon>
          Add Variable
        </rh-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'global-settings': GlobalSettings;
  }
}
