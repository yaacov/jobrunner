/**
 * Pipeline Detail - Shows detailed view of a single pipeline
 * Following RHDS patterns for tabs and data display
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Pipeline, StepStatus, PipelineStep } from '../../types/pipeline.js';
import { k8sClient } from '../../lib/k8s-client.js';
import { navigate } from '../../lib/router.js';
import { pipelineToGraph, layoutGraph, type PipelineGraph } from '../../lib/graph-layout.js';

interface RouteLocation {
  params: { namespace?: string; name?: string };
}

@customElement('pipeline-detail')
export class PipelineDetail extends LitElement {
  @property({ type: Object }) location?: RouteLocation;

  @state() private pipeline: Pipeline | null = null;
  @state() private loading = true;
  @state() private error: string | null = null;
  @state() private selectedStep: string | null = null;
  @state() private activeTab = 0;
  @state() private graph: PipelineGraph | null = null;

  // Cached step data to prevent unnecessary re-renders of step-detail
  private cachedStep: PipelineStep | null = null;
  private cachedStatus: StepStatus | null = null;
  private cachedStepName: string | null = null;

  private pollInterval?: ReturnType<typeof setInterval>;

  static styles = css`
    :host {
      display: block;
    }

    rh-breadcrumb {
      display: block;
      margin-block-end: var(--rh-space-lg, 24px);
    }

    /* Breadcrumb light DOM styles (needed inside shadow DOM) */
    rh-breadcrumb ol {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
    }

    rh-breadcrumb li {
      display: flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
    }

    rh-breadcrumb li:not(:last-child)::after {
      content: '/';
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      margin-inline-start: var(--rh-space-xs, 4px);
    }

    rh-breadcrumb a {
      color: var(--rh-color-interactive-blue-darker, #0066cc);
      text-decoration: none;
      transition: color 150ms ease;
    }

    rh-breadcrumb a:hover {
      color: var(--rh-color-interactive-blue-darkest, #004d99);
      text-decoration: underline;
    }

    rh-breadcrumb a[aria-current="page"] {
      color: var(--rh-color-text-primary-on-light, #151515);
      pointer-events: none;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-block-end: var(--rh-space-xl, 32px);
      flex-wrap: wrap;
      gap: var(--rh-space-md, 16px);
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: var(--rh-space-sm, 8px);
    }

    .header-left h1 {
      display: flex;
      align-items: center;
      gap: var(--rh-space-md, 16px);
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      font-size: var(--rh-font-size-heading-lg, 1.75rem);
      font-weight: var(--rh-font-weight-heading-medium, 500);
      margin: 0;
    }

    .header-meta {
      display: flex;
      gap: var(--rh-space-xl, 32px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
    }

    .header-meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .header-meta-label {
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .header-actions {
      display: flex;
      gap: var(--rh-space-sm, 8px);
    }

    .content {
      display: block;
    }

    .graph-container {
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      padding: var(--rh-space-lg, 24px);
      position: relative;
    }

    .graph-canvas {
      position: relative;
    }

    .graph-node {
      position: absolute;
      background: var(--rh-color-surface-lightest, #ffffff);
      border: 2px solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      padding: var(--rh-space-md, 16px);
      min-width: 180px;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .graph-node:hover {
      box-shadow: var(--rh-box-shadow-md, 0 4px 6px -1px rgba(21, 21, 21, 0.1));
    }

    .graph-node:focus-visible {
      outline: var(--rh-border-width-md, 2px) solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 2px;
    }

    .graph-node.selected {
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
    }

    .graph-node.succeeded { border-color: var(--rh-color-green-500, #3e8635); }
    .graph-node.running { border-color: var(--rh-color-teal-500, #009596); }
    .graph-node.failed { border-color: var(--rh-color-red-500, #c9190b); }

    .node-header {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
      margin-block-end: var(--rh-space-xs, 4px);
    }

    .node-name {
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
    }

    .node-image {
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .timeline-table {
      width: 100%;
      border-collapse: collapse;
    }

    .timeline-table th,
    .timeline-table td {
      padding: var(--rh-space-sm, 8px) var(--rh-space-md, 16px);
      text-align: start;
      border-block-end: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .timeline-table th {
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .timeline-table tbody tr {
      cursor: pointer;
      transition: background-color 150ms ease;
    }

    .timeline-table tbody tr:hover {
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .yaml-container rh-code-block {
      display: block;
    }

    .loading-container,
    .error-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: var(--rh-space-2xl, 48px);
      gap: var(--rh-space-md, 16px);
    }

    .error-container {
      color: var(--rh-color-red-700, #a30d05);
    }

    rh-tabs {
      margin-block-end: var(--rh-space-lg, 24px);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadPipeline();
    this.pollInterval = setInterval(() => this.loadPipeline(), 3000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private get params(): { namespace: string; name: string } {
    return {
      namespace: this.location?.params?.namespace || 'default',
      name: this.location?.params?.name || '',
    };
  }

  private async loadPipeline() {
    const { namespace, name } = this.params;
    if (!name) return;

    try {
      this.pipeline = await k8sClient.getPipeline(namespace, name);
      this.error = null;

      // Generate graph layout
      const rawGraph = pipelineToGraph(this.pipeline);
      this.graph = await layoutGraph(rawGraph);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load pipeline';
    } finally {
      this.loading = false;
    }
  }

  private async deletePipeline() {
    if (!this.pipeline) return;

    const confirmed = confirm(`Are you sure you want to delete pipeline "${this.pipeline.metadata.name}"?`);
    if (!confirmed) return;

    try {
      await k8sClient.deletePipeline(
        this.pipeline.metadata.namespace || 'default',
        this.pipeline.metadata.name
      );
      navigate('/monitor');
    } catch (e) {
      alert(`Failed to delete pipeline: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  private formatDuration(startTime?: string, endTime?: string): string {
    if (!startTime) return '-';

    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;

    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }

  private getStepImage(step: PipelineStep): string {
    const container = step.jobSpec.template.spec.containers[0];
    return container?.image || 'default';
  }

  private selectStep(stepName: string) {
    this.selectedStep = stepName;
  }

  private closeDrawer() {
    this.selectedStep = null;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading-container">
          <rh-spinner size="lg"></rh-spinner>
          <span>Loading pipeline...</span>
        </div>
      `;
    }

    if (this.error || !this.pipeline) {
      return html`
        <div class="error-container">
          <rh-icon set="ui" icon="error-filled" style="--rh-icon-size: 32px"></rh-icon>
          <span>${this.error || 'Pipeline not found'}</span>
          <rh-button @click=${() => navigate('/monitor')}>
            <rh-icon set="ui" icon="arrow-left" slot="icon"></rh-icon>
            Back to Pipelines
          </rh-button>
        </div>
      `;
    }

    const phase = this.pipeline.status?.phase || 'Pending';

    return html`
      <rh-breadcrumb>
        <ol>
          <li><a href="/monitor" @click=${(e: Event) => { e.preventDefault(); navigate('/monitor'); }}>Pipelines</a></li>
          <li><a href="" aria-current="page">${this.pipeline.metadata.name}</a></li>
        </ol>
      </rh-breadcrumb>

      <header class="header">
        <div class="header-left">
          <h1>
            ${this.pipeline.metadata.name}
            <status-badge status=${phase}></status-badge>
          </h1>
          <div class="header-meta">
            <div class="header-meta-item">
              <span class="header-meta-label">Namespace</span>
              <span>${this.pipeline.metadata.namespace || 'default'}</span>
            </div>
            <div class="header-meta-item">
              <span class="header-meta-label">Duration</span>
              <span>${this.formatDuration(this.pipeline.status?.startTime, this.pipeline.status?.completionTime)}</span>
            </div>
            <div class="header-meta-item">
              <span class="header-meta-label">Steps</span>
              <span>${this.pipeline.status?.steps?.filter(s => s.phase === 'Succeeded').length || 0}/${this.pipeline.spec.steps.length}</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <rh-button variant="secondary" @click=${this.loadPipeline}>
            <rh-icon set="ui" icon="refresh" slot="icon"></rh-icon>
            Refresh
          </rh-button>
          <rh-button variant="danger" @click=${this.deletePipeline}>
            <rh-icon set="ui" icon="trash" slot="icon"></rh-icon>
            Delete
          </rh-button>
        </div>
      </header>

      <rh-tabs @click=${(e: Event) => {
        const tab = (e.target as HTMLElement).closest('rh-tab');
        if (tab) {
          const tabs = this.shadowRoot?.querySelectorAll('rh-tab');
          tabs?.forEach((t, i) => {
            if (t === tab) this.activeTab = i;
          });
        }
      }}>
        <rh-tab slot="tab">
          <rh-icon set="standard" icon="network" slot="icon"></rh-icon>
          Graph
        </rh-tab>
        <rh-tab-panel>
          ${this.renderGraph()}
        </rh-tab-panel>

        <rh-tab slot="tab">
          <rh-icon set="ui" icon="list" slot="icon"></rh-icon>
          Timeline
        </rh-tab>
        <rh-tab-panel>
          ${this.renderTimeline()}
        </rh-tab-panel>

        <rh-tab slot="tab">
          <rh-icon set="ui" icon="code" slot="icon"></rh-icon>
          YAML
        </rh-tab>
        <rh-tab-panel>
          ${this.renderYaml()}
        </rh-tab-panel>
      </rh-tabs>

      <div class="content">
        <div id="tab-content">
          <!-- Content rendered by tabs above -->
        </div>
      </div>

      <!-- Side Drawer for Step Details -->
      <side-drawer
        ?open=${!!this.selectedStep}
        heading="Step Details"
        @close=${this.closeDrawer}
      >
        ${this.selectedStep ? this.renderStepDetails() : ''}
      </side-drawer>
    `;
  }

  private renderStepDetails() {
    const step = this.pipeline?.spec.steps.find(s => s.name === this.selectedStep);
    const status = this.pipeline?.status?.steps?.find(s => s.name === this.selectedStep);

    if (!step) return '';

    // Only update cached values if step changed or status meaningfully changed
    const stepChanged = this.cachedStepName !== this.selectedStep;
    const statusChanged = this.hasStatusChanged(this.cachedStatus, status);
    
    if (stepChanged || statusChanged || !this.cachedStep) {
      this.cachedStep = step;
      this.cachedStatus = status || null;
      this.cachedStepName = this.selectedStep;
    }

    return html`
      <step-detail
        .step=${this.cachedStep}
        .status=${this.cachedStatus}
        .namespace=${this.pipeline?.metadata.namespace || 'default'}
      ></step-detail>
    `;
  }

  private hasStatusChanged(oldStatus: StepStatus | null | undefined, newStatus: StepStatus | null | undefined): boolean {
    if (!oldStatus && !newStatus) return false;
    if (!oldStatus || !newStatus) return true;
    
    // Compare key fields that would affect the UI
    return (
      oldStatus.phase !== newStatus.phase ||
      oldStatus.jobName !== newStatus.jobName ||
      oldStatus.jobStatus?.succeeded !== newStatus.jobStatus?.succeeded ||
      oldStatus.jobStatus?.failed !== newStatus.jobStatus?.failed ||
      oldStatus.jobStatus?.completionTime !== newStatus.jobStatus?.completionTime
    );
  }

  private renderGraph() {
    if (!this.graph) return html`<div class="graph-container">Loading graph...</div>`;

    // Calculate canvas dimensions based on node positions
    // Node dimensions from graph-layout.ts: width=240, height=100
    const nodeWidth = 240;
    const nodeHeight = 100;
    const padding = 20;
    
    let maxX = 0;
    let maxY = 0;
    for (const node of this.graph.nodes) {
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    }
    
    const canvasWidth = maxX + padding;
    const canvasHeight = maxY + padding;

    return html`
      <div class="graph-container">
        <div class="graph-canvas" style="width: ${canvasWidth}px; height: ${canvasHeight}px;">
          ${this.graph.nodes.map(node => {
            const phase = node.data.status?.phase?.toLowerCase() || 'pending';
            return html`
              <div
                class="graph-node ${phase} ${this.selectedStep === node.id ? 'selected' : ''}"
                style="left: ${node.position.x}px; top: ${node.position.y}px"
                tabindex="0"
                role="button"
                aria-pressed=${this.selectedStep === node.id}
                @click=${() => this.selectStep(node.id)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectStep(node.id);
                  }
                }}
              >
                <div class="node-header">
                  <status-badge status=${node.data.status?.phase || 'Pending'} size="sm"></status-badge>
                  <span class="node-name">${node.data.step.name}</span>
                </div>
                <div class="node-image">${this.getStepImage(node.data.step)}</div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderTimeline() {
    if (!this.pipeline) return '';

    const steps = this.pipeline.spec.steps.map(specStep => {
      const status = this.pipeline!.status?.steps?.find(s => s.name === specStep.name);
      return { spec: specStep, status };
    });

    return html`
      <rh-table>
        <table class="timeline-table">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Status</th>
              <th scope="col">Started</th>
              <th scope="col">Duration</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${steps.map(({ spec, status }) => html`
              <tr @click=${() => this.selectStep(spec.name)}>
                <td><strong>${spec.name}</strong></td>
                <td>
                  <status-badge status=${status?.phase || 'Pending'} size="sm"></status-badge>
                </td>
                <td>${status?.jobStatus?.startTime ? new Date(status.jobStatus.startTime).toLocaleTimeString() : '-'}</td>
                <td>${this.formatDuration(status?.jobStatus?.startTime, status?.jobStatus?.completionTime)}</td>
                <td>
                  <rh-button variant="link" @click=${(e: Event) => { e.stopPropagation(); this.selectStep(spec.name); }}>
                    View Details
                  </rh-button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </rh-table>
    `;
  }

  private renderYaml() {
    if (!this.pipeline) return '';

    // Simple YAML-like display (JSON formatted)
    const yaml = JSON.stringify(this.pipeline, null, 2);

    return html`
      <div class="yaml-container">
        <rh-code-block>
          <script type="application/json">${yaml}</script>
        </rh-code-block>
      </div>
    `;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'pipeline-detail': PipelineDetail;
  }
}
