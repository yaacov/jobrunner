/**
 * Pipeline List - Displays all pipelines with status
 * Following RHDS card and list patterns
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Pipeline, StepStatus } from '../../types/pipeline.js';
import { k8sClient } from '../../lib/k8s-client.js';
import { navigate } from '../../lib/router.js';

type SortColumn = 'name' | 'status' | 'created';
type SortDirection = 'asc' | 'desc';

@customElement('pipeline-list')
export class PipelineList extends LitElement {
  @state() private pipelines: Pipeline[] = [];
  @state() private loading = true;
  @state() private error: string | null = null;
  @state() private searchQuery = '';
  @state() private namespace = 'default';
  @state() private sortColumn: SortColumn = 'created';
  @state() private sortDirection: SortDirection = 'desc';

  private pollInterval?: ReturnType<typeof setInterval>;

  static styles = css`
    :host {
      display: block;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-block-end: var(--rh-space-xl, 32px);
      flex-wrap: wrap;
      gap: var(--rh-space-md, 16px);
    }

    h1 {
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      font-size: var(--rh-font-size-heading-lg, 1.75rem);
      font-weight: var(--rh-font-weight-heading-medium, 500);
      margin: 0;
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .controls {
      display: flex;
      gap: var(--rh-space-md, 16px);
      align-items: center;
    }

    .search-input {
      padding: var(--rh-space-sm, 8px) var(--rh-space-md, 16px);
      padding-inline-start: var(--rh-space-xl, 32px);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-md, 1rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      min-width: 280px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236a6e73' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: var(--rh-space-sm, 8px) center;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      box-shadow: 0 0 0 1px var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .pipeline-table-container {
      background: var(--rh-color-surface-lightest, #ffffff);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      overflow: hidden;
    }

    .pipeline-table {
      width: 100%;
      border-collapse: collapse;
    }

    .pipeline-table th,
    .pipeline-table td {
      padding: var(--rh-space-md, 16px);
      text-align: start;
      border-block-end: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .pipeline-table th {
      background: var(--rh-color-surface-lighter, #f5f5f5);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      white-space: nowrap;
    }

    .pipeline-table th.sortable {
      cursor: pointer;
      user-select: none;
      transition: background-color 150ms ease;
    }

    .pipeline-table th.sortable:hover {
      background: var(--rh-color-surface-light, #e0e0e0);
    }

    .pipeline-table th.sortable .sort-header {
      display: inline-flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
    }

    .pipeline-table th.sortable rh-icon {
      --rh-icon-size: 14px;
      opacity: 0.5;
    }

    .pipeline-table th.sortable.active rh-icon {
      opacity: 1;
      color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .pipeline-table tbody tr {
      cursor: pointer;
      transition: background-color 150ms ease;
    }

    .pipeline-table tbody tr:hover {
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .pipeline-table tbody tr:focus-visible {
      outline: var(--rh-border-width-md, 2px) solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: -2px;
    }

    .pipeline-table tbody tr:last-child td {
      border-block-end: none;
    }

    .pipeline-name {
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .pipeline-name:hover {
      text-decoration: underline;
    }

    .steps-inline {
      display: flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
      flex-wrap: wrap;
    }

    .step-chip {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px 6px;
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
      white-space: nowrap;
    }

    .step-chip.pending {
      background: var(--rh-color-gray-20, #e0e0e0);
      color: var(--rh-color-gray-60, #6a6e73);
    }

    .step-chip.running {
      background: var(--rh-color-teal-100, #e0f5f5);
      color: var(--rh-color-teal-700, #005f60);
    }

    .step-chip.succeeded {
      background: var(--rh-color-green-100, #e6f4e4);
      color: var(--rh-color-green-700, #2e6527);
    }

    .step-chip.failed {
      background: var(--rh-color-red-100, #fce8e6);
      color: var(--rh-color-red-700, #a30d05);
    }

    .step-chip.skipped {
      background: var(--rh-color-gray-10, #f5f5f5);
      color: var(--rh-color-gray-50, #8a8d90);
      text-decoration: line-through;
    }

    .step-chip rh-icon {
      --rh-icon-size: 12px;
    }

    .created-time {
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .step-chip.running rh-icon {
      animation: pulse 1.5s ease-in-out infinite;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: var(--rh-space-2xl, 48px);
      gap: var(--rh-space-md, 16px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .error-container {
      padding: var(--rh-space-lg, 24px);
      background: var(--rh-color-red-100, #fce8e6);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-red-500, #c9190b);
      border-radius: var(--rh-border-radius-default, 3px);
    }

    .error-container h4 {
      margin: 0 0 var(--rh-space-sm, 8px) 0;
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      color: var(--rh-color-red-700, #a30d05);
    }

    .error-container p {
      margin: 0 0 var(--rh-space-md, 16px) 0;
      color: var(--rh-color-red-700, #a30d05);
    }

    .empty-state {
      text-align: center;
      padding: var(--rh-space-2xl, 48px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .empty-state rh-icon {
      --rh-icon-size: 48px;
      color: var(--rh-color-gray-40, #8a8d90);
      margin-block-end: var(--rh-space-md, 16px);
    }

    .empty-state h3 {
      margin: 0 0 var(--rh-space-md, 16px) 0;
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .empty-state p {
      margin: 0 0 var(--rh-space-lg, 24px) 0;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadPipelines();

    // Poll for updates every 5 seconds
    this.pollInterval = setInterval(() => this.loadPipelines(), 5000);

    // Listen for namespace changes
    window.addEventListener('namespace-change', ((e: CustomEvent) => {
      this.namespace = e.detail.namespace;
      this.loadPipelines();
    }) as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private async loadPipelines() {
    try {
      this.pipelines = await k8sClient.listPipelines(this.namespace);
      this.error = null;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load pipelines';
    } finally {
      this.loading = false;
    }
  }

  private navigateToPipeline(pipeline: Pipeline) {
    const namespace = pipeline.metadata.namespace || 'default';
    const name = pipeline.metadata.name;
    navigate(`/monitor/${namespace}/${name}`);
  }

  private getCompletedSteps(steps: StepStatus[]): number {
    return steps.filter(s =>
      s.phase === 'Succeeded' || s.phase === 'Failed' || s.phase === 'Skipped'
    ).length;
  }

  private getStepState(phase: string): 'inactive' | 'active' | 'complete' | 'warn' | 'fail' {
    switch (phase) {
      case 'Succeeded': return 'complete';
      case 'Running': return 'active';
      case 'Failed': return 'fail';
      case 'Skipped': return 'inactive';
      case 'Pending':
      default: return 'inactive';
    }
  }

  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  private get filteredPipelines(): Pipeline[] {
    let result = this.pipelines;
    
    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(p =>
        p.metadata.name.toLowerCase().includes(query)
      );
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortColumn) {
        case 'name':
          comparison = a.metadata.name.localeCompare(b.metadata.name);
          break;
        case 'status':
          comparison = (a.status?.phase || 'Pending').localeCompare(b.status?.phase || 'Pending');
          break;
        case 'created':
          const aTime = a.metadata.creationTimestamp ? new Date(a.metadata.creationTimestamp).getTime() : 0;
          const bTime = b.metadata.creationTimestamp ? new Date(b.metadata.creationTimestamp).getTime() : 0;
          comparison = aTime - bTime;
          break;
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }

  private toggleSort(column: SortColumn) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = column === 'created' ? 'desc' : 'asc';
    }
  }

  private getSortIcon(column: SortColumn): string {
    if (this.sortColumn !== column) return 'arrow-up-down';
    return this.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading-container">
          <rh-spinner size="lg"></rh-spinner>
          <span>Loading pipelines...</span>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error-container">
          <h4>
            <rh-icon set="ui" icon="error-filled"></rh-icon>
            Error loading pipelines
          </h4>
          <p>${this.error}</p>
          <rh-button @click=${this.loadPipelines}>
            <rh-icon set="ui" icon="refresh" slot="icon"></rh-icon>
            Retry
          </rh-button>
        </div>
      `;
    }

    return html`
      <div class="header">
        <h1>Pipelines</h1>
        <div class="controls">
          <input
            type="search"
            class="search-input"
            placeholder="Search pipelines..."
            .value=${this.searchQuery}
            @input=${(e: Event) => this.searchQuery = (e.target as HTMLInputElement).value}
            aria-label="Search pipelines"
          />
          <rh-button @click=${() => navigate('/builder')}>
            <rh-icon set="ui" icon="add-circle" slot="icon"></rh-icon>
            New Pipeline
          </rh-button>
        </div>
      </div>

      ${this.filteredPipelines.length === 0 ? html`
        <div class="empty-state">
          <rh-icon set="standard" icon="data-science"></rh-icon>
          <h3>No pipelines found</h3>
          <p>Create your first pipeline to get started.</p>
          <rh-cta>
            <a href="/builder">Create Pipeline</a>
          </rh-cta>
        </div>
      ` : html`
        <div class="pipeline-table-container">
          <table class="pipeline-table">
            <thead>
              <tr>
                <th 
                  class="sortable ${this.sortColumn === 'name' ? 'active' : ''}"
                  @click=${() => this.toggleSort('name')}
                >
                  <span class="sort-header">
                    Name
                    <rh-icon set="ui" icon=${this.getSortIcon('name')}></rh-icon>
                  </span>
                </th>
                <th 
                  class="sortable ${this.sortColumn === 'status' ? 'active' : ''}"
                  @click=${() => this.toggleSort('status')}
                >
                  <span class="sort-header">
                    Status
                    <rh-icon set="ui" icon=${this.getSortIcon('status')}></rh-icon>
                  </span>
                </th>
                <th>Steps</th>
                <th 
                  class="sortable ${this.sortColumn === 'created' ? 'active' : ''}"
                  @click=${() => this.toggleSort('created')}
                >
                  <span class="sort-header">
                    Created
                    <rh-icon set="ui" icon=${this.getSortIcon('created')}></rh-icon>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              ${this.filteredPipelines.map(pipeline => this.renderPipelineRow(pipeline))}
            </tbody>
          </table>
        </div>
      `}
    `;
  }

  private renderPipelineRow(pipeline: Pipeline) {
    const phase = pipeline.status?.phase || 'Pending';
    const steps = pipeline.status?.steps || [];
    const specSteps = pipeline.spec.steps || [];

    // Merge spec steps with status
    const mergedSteps = specSteps.map(specStep => {
      const statusStep = steps.find(s => s.name === specStep.name);
      return {
        name: specStep.name,
        phase: statusStep?.phase || 'Pending',
      };
    });

    const stepIcon = (stepPhase: string) => {
      switch (stepPhase) {
        case 'Succeeded': return 'check';
        case 'Running': return 'in-progress';
        case 'Failed': return 'close';
        case 'Skipped': return 'minus';
        default: return 'clock';
      }
    };

    return html`
      <tr
        tabindex="0"
        @click=${() => this.navigateToPipeline(pipeline)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.navigateToPipeline(pipeline);
          }
        }}
      >
        <td>
          <span class="pipeline-name">${pipeline.metadata.name}</span>
        </td>
        <td>
          <status-badge status=${phase} size="sm"></status-badge>
        </td>
        <td>
          <div class="steps-inline">
            ${mergedSteps.map(step => html`
              <span class="step-chip ${step.phase.toLowerCase()}" title="${step.name}: ${step.phase}">
                <rh-icon set="ui" icon=${stepIcon(step.phase)}></rh-icon>
                ${step.name}
              </span>
            `)}
          </div>
        </td>
        <td>
          <span class="created-time">
            ${pipeline.metadata.creationTimestamp 
              ? this.formatTime(pipeline.metadata.creationTimestamp)
              : '-'}
          </span>
        </td>
      </tr>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pipeline-list': PipelineList;
  }
}
