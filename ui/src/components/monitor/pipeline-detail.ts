/**
 * Pipeline Detail - Shows detailed view of a single pipeline
 * Following RHDS patterns for tabs and data display
 */

import { LitElement, html, css, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { stringify as yamlStringify } from 'yaml';
import type {
  Pipeline,
  StepStatus,
  PipelineStep,
  PipelineGraph,
  PipelineEdge,
  PipelineNode,
} from '../../types/pipeline.js';
import { k8sClient } from '../../lib/k8s-client.js';
import { navigate } from '../../lib/router.js';
import { pipelineToGraph, layoutGraph } from '../../lib/graph-layout.js';

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
  @state() private openMenuId: string | null = null;

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

    rh-breadcrumb a[aria-current='page'] {
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
      width: 240px;
      height: 100px;
      box-sizing: border-box;
      cursor: pointer;
      transition: all 150ms ease;
      overflow: hidden;
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

    .graph-node.succeeded {
      border-color: var(--rh-color-green-500, #3e8635);
    }
    .graph-node.running {
      border-color: var(--rh-color-teal-500, #009596);
    }
    .graph-node.failed {
      border-color: var(--rh-color-red-500, #c9190b);
    }

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

    .graph-edges {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      overflow: visible;
    }

    .graph-edge {
      fill: none;
      stroke: var(--rh-color-gray-40, #8a8d90);
      stroke-width: 2;
    }

    .graph-edge.success {
      stroke: var(--rh-color-green-500, #3e8635);
    }

    .graph-edge.failure {
      stroke: var(--rh-color-red-500, #c9190b);
    }

    .graph-arrow {
      fill: var(--rh-color-gray-40, #8a8d90);
    }

    .graph-arrow.success {
      fill: var(--rh-color-green-500, #3e8635);
    }

    .graph-arrow.failure {
      fill: var(--rh-color-red-500, #c9190b);
    }

    rh-table {
      overflow: visible;
    }

    .timeline-table {
      width: 100%;
      border-collapse: collapse;
      overflow: visible;
    }

    .timeline-table th,
    .timeline-table td {
      padding: var(--rh-space-sm, 8px) var(--rh-space-md, 16px);
      text-align: start;
      border-block-end: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
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

    /* Kebab menu styles for timeline */
    .actions-cell {
      position: relative;
      width: 48px;
      text-align: center;
      overflow: visible;
    }

    .timeline-table tbody {
      overflow: visible;
    }

    .timeline-table tbody tr {
      overflow: visible;
    }

    .kebab-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: none;
      border: none;
      border-radius: var(--rh-border-radius-default, 3px);
      cursor: pointer;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }

    .kebab-btn:hover {
      background: var(--rh-color-surface-light, #e0e0e0);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .kebab-btn:focus {
      outline: none;
    }

    .kebab-menu {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 1000;
      min-width: 150px;
      background: var(--rh-color-surface-lightest, #ffffff);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      box-shadow: var(--rh-box-shadow-md, 0 4px 6px -1px rgba(21, 21, 21, 0.1));
      padding: var(--rh-space-xs, 4px) 0;
    }

    .kebab-menu-item {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
      width: 100%;
      padding: var(--rh-space-sm, 8px) var(--rh-space-md, 16px);
      background: none;
      border: none;
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      color: var(--rh-color-text-primary-on-light, #151515);
      cursor: pointer;
      text-align: left;
      transition: background-color 150ms ease;
    }

    .kebab-menu-item:hover {
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .kebab-menu-item:focus {
      outline: none;
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .kebab-menu-item rh-icon {
      --rh-icon-size: 16px;
    }

    .yaml-container {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .yaml-container code-editor {
      display: block;
      width: 100%;
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
      /* Override RHDS focus custom properties */
      --rh-tabs-link-focus-outline: none;
      --rh-tabs-focus-outline: none;
    }

    /* Remove blue focus outline from tabs and panels */
    rh-tabs,
    rh-tabs::part(tabs),
    rh-tabs::part(panels) {
      outline: none !important;
    }

    rh-tab,
    rh-tab-panel {
      outline: none !important;
      /* Override any RHDS focus variables */
      --rh-tab-focus-outline: none;
      --rh-focus-outline-color: transparent;
      --rh-focus-outline-width: 0;
    }

    rh-tab:focus,
    rh-tab:focus-within,
    rh-tab-panel:focus {
      outline: none !important;
      box-shadow: none !important;
    }

    rh-tab:focus-visible {
      outline: none !important;
      box-shadow: none !important;
    }

    /* Target internal button if exposed via ::part */
    rh-tab::part(button),
    rh-tab::part(tab) {
      outline: none !important;
    }

    rh-tab::part(button):focus,
    rh-tab::part(button):focus-visible,
    rh-tab::part(tab):focus,
    rh-tab::part(tab):focus-visible {
      outline: none !important;
      box-shadow: none !important;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadPipeline();
    this.pollInterval = setInterval(() => this.loadPipeline(), 3000);
    document.addEventListener('click', this.handleDocumentClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    document.removeEventListener('click', this.handleDocumentClick);
  }

  private handleDocumentClick = () => {
    this.closeMenu();
  };

  private toggleMenu(e: Event, stepName: string) {
    e.stopPropagation();
    this.openMenuId = this.openMenuId === stepName ? null : stepName;
  }

  private closeMenu() {
    this.openMenuId = null;
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

    const confirmed = confirm(
      `Are you sure you want to delete pipeline "${this.pipeline.metadata.name}"?`
    );
    if (!confirmed) return;

    try {
      await k8sClient.deletePipeline(
        this.pipeline.metadata.namespace || 'default',
        this.pipeline.metadata.name
      );
      navigate('/pipelines');
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
          <rh-icon set="ui" icon="error-fill" style="--rh-icon-size: 32px"></rh-icon>
          <span>${this.error || 'Pipeline not found'}</span>
          <rh-button @click=${() => navigate('/pipelines')}>
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
          <li>
            <a
              href="/pipelines"
              @click=${(e: Event) => {
                e.preventDefault();
                navigate('/pipelines');
              }}
              >Pipelines</a
            >
          </li>
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
              <span
                >${this.formatDuration(
                  this.pipeline.status?.startTime,
                  this.pipeline.status?.completionTime
                )}</span
              >
            </div>
            <div class="header-meta-item">
              <span class="header-meta-label">Steps</span>
              <span
                >${this.pipeline.status?.steps?.filter(s => s.phase === 'Succeeded').length ||
                0}/${this.pipeline.spec.steps.length}</span
              >
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

      <rh-tabs
        @click=${(e: Event) => {
          const tab = (e.target as HTMLElement).closest('rh-tab');
          if (tab) {
            const tabs = this.shadowRoot?.querySelectorAll('rh-tab');
            tabs?.forEach((t, i) => {
              if (t === tab) this.activeTab = i;
            });
          }
        }}
      >
        <rh-tab slot="tab">
          <rh-icon set="ui" icon="network" slot="icon"></rh-icon>
          Graph
        </rh-tab>
        <rh-tab-panel> ${this.renderGraph()} </rh-tab-panel>

        <rh-tab slot="tab">
          <rh-icon set="ui" icon="list" slot="icon"></rh-icon>
          Timeline
        </rh-tab>
        <rh-tab-panel> ${this.renderTimeline()} </rh-tab-panel>

        <rh-tab slot="tab">
          <rh-icon set="ui" icon="code" slot="icon"></rh-icon>
          YAML
        </rh-tab>
        <rh-tab-panel> ${this.renderYaml()} </rh-tab-panel>
      </rh-tabs>

      <div class="content">
        <div id="tab-content">
          <!-- Content rendered by tabs above -->
        </div>
      </div>

      <!-- Side Drawer for Step Details -->
      <side-drawer
        ?open=${!!this.selectedStep}
        heading=${this.selectedStep ? `Step: ${this.selectedStep}` : 'Step Details'}
        .showWidthToggle=${true}
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

  private hasStatusChanged(
    oldStatus: StepStatus | null | undefined,
    newStatus: StepStatus | null | undefined
  ): boolean {
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

    // Build a map of node positions for edge rendering
    const nodePositions = new Map<string, { x: number; y: number; width: number }>();
    for (const node of this.graph.nodes) {
      nodePositions.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: nodeWidth,
      });
    }

    // Count outgoing edges per source and incoming edges per target
    const outgoingEdges = new Map<string, PipelineEdge[]>();
    const incomingEdges = new Map<string, PipelineEdge[]>();
    for (const edge of this.graph.edges) {
      if (!outgoingEdges.has(edge.source)) outgoingEdges.set(edge.source, []);
      if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, []);
      outgoingEdges.get(edge.source)!.push(edge);
      incomingEdges.get(edge.target)!.push(edge);
    }

    return html`
      <div class="graph-container">
        <div class="graph-canvas" style="width: ${canvasWidth}px; height: ${canvasHeight}px;">
          <!-- Render edges first (behind nodes) -->
          <svg class="graph-edges" width="${canvasWidth}" height="${canvasHeight}">
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" class="graph-arrow" />
              </marker>
              <marker
                id="arrow-success"
                markerWidth="6"
                markerHeight="6"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 z" class="graph-arrow success" />
              </marker>
              <marker
                id="arrow-failure"
                markerWidth="6"
                markerHeight="6"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 z" class="graph-arrow failure" />
              </marker>
            </defs>
            ${this.graph.edges.map((edge: PipelineEdge) => {
              const sourceNode = nodePositions.get(edge.source);
              const targetNode = nodePositions.get(edge.target);
              if (!sourceNode || !targetNode) return '';

              // Calculate offset for this edge among all outgoing edges from source
              const sourceEdges = outgoingEdges.get(edge.source) || [];
              const sourceIndex = sourceEdges.indexOf(edge);
              const sourceCount = sourceEdges.length;

              // Calculate offset for this edge among all incoming edges to target
              const targetEdges = incomingEdges.get(edge.target) || [];
              const targetIndex = targetEdges.indexOf(edge);
              const targetCount = targetEdges.length;

              // Spread connection points around center (max 120px total spread)
              const maxSpread = 120;
              const centerX = nodeWidth / 2;

              // Calculate X position for source (bottom of node)
              const sourceSpread = Math.min(maxSpread, (sourceCount - 1) * 25);
              const sourceStartX = centerX - sourceSpread / 2;
              const sourceSpacing = sourceCount > 1 ? sourceSpread / (sourceCount - 1) : 0;
              const sourceOffsetX =
                sourceCount > 1 ? sourceStartX + sourceIndex * sourceSpacing : centerX;
              const x1 = sourceNode.x + sourceOffsetX;
              const y1 = sourceNode.y + nodeHeight; // Start at bottom of source node

              // Calculate X position for target (top of node)
              const targetSpread = Math.min(maxSpread, (targetCount - 1) * 25);
              const targetStartX = centerX - targetSpread / 2;
              const targetSpacing = targetCount > 1 ? targetSpread / (targetCount - 1) : 0;
              const targetOffsetX =
                targetCount > 1 ? targetStartX + targetIndex * targetSpacing : centerX;
              const x2 = targetNode.x + targetOffsetX;
              const y2 = targetNode.y - 2; // End at top of target node (arrow will point to it)

              // Create a curved path with control points offset for smoother curves
              const deltaY = y2 - y1;
              const controlOffset = Math.max(Math.abs(deltaY) * 0.4, 20);
              const path = `M ${x1} ${y1} C ${x1} ${y1 + controlOffset}, ${x2} ${y2 - controlOffset}, ${x2} ${y2}`;

              const edgeClass =
                edge.type === 'failure' ? 'failure' : edge.type === 'success' ? 'success' : '';
              const markerId =
                edge.type === 'failure'
                  ? 'arrow-failure'
                  : edge.type === 'success'
                    ? 'arrow-success'
                    : 'arrow';

              return svg`
                <path 
                  class="graph-edge ${edgeClass}" 
                  d="${path}"
                  marker-end="url(#${markerId})"
                />
              `;
            })}
          </svg>

          <!-- Render nodes -->
          ${this.graph.nodes.map((node: PipelineNode) => {
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
                  <status-badge
                    status=${node.data.status?.phase || 'Pending'}
                    size="sm"
                  ></status-badge>
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
            ${steps.map(
              ({ spec, status }) => html`
                <tr @click=${() => this.selectStep(spec.name)}>
                  <td><strong>${spec.name}</strong></td>
                  <td>
                    <status-badge status=${status?.phase || 'Pending'} size="sm"></status-badge>
                  </td>
                  <td>
                    ${status?.jobStatus?.startTime
                      ? new Date(status.jobStatus.startTime).toLocaleTimeString()
                      : '-'}
                  </td>
                  <td>
                    ${this.formatDuration(
                      status?.jobStatus?.startTime,
                      status?.jobStatus?.completionTime
                    )}
                  </td>
                  <td class="actions-cell">
                    <button
                      class="kebab-btn"
                      @click=${(e: Event) => this.toggleMenu(e, spec.name)}
                      aria-label="Actions for ${spec.name}"
                      aria-haspopup="true"
                      aria-expanded=${this.openMenuId === spec.name}
                    >
                      <rh-icon set="ui" icon="ellipsis-vertical"></rh-icon>
                    </button>
                    ${this.openMenuId === spec.name
                      ? html`
                          <div class="kebab-menu" role="menu">
                            <button
                              class="kebab-menu-item"
                              role="menuitem"
                              @click=${(e: Event) => {
                                e.stopPropagation();
                                this.closeMenu();
                                this.selectStep(spec.name);
                              }}
                            >
                              <rh-icon set="ui" icon="view"></rh-icon>
                              View Details
                            </button>
                          </div>
                        `
                      : ''}
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </rh-table>
    `;
  }

  private renderYaml() {
    if (!this.pipeline) return '';

    // Convert to properly formatted YAML
    const yamlContent = yamlStringify(this.pipeline, {
      indent: 2,
      lineWidth: 0, // Don't wrap lines
      defaultKeyType: 'PLAIN',
      defaultStringType: 'QUOTE_DOUBLE',
    });

    return html`
      <div class="yaml-container">
        <code-editor
          .value=${yamlContent}
          language="yaml"
          .readonly=${true}
          .showLanguageSelector=${false}
          minHeight="400px"
        ></code-editor>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pipeline-detail': PipelineDetail;
  }
}
