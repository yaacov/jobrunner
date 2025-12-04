/**
 * Step Detail - Shows detailed information about a pipeline step
 * Following RHDS patterns for panels and data display
 */

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import type { PipelineStep, StepStatus } from '../../types/pipeline.js';
import { k8sClient } from '../../lib/k8s-client.js';

// Number of tail lines to show in logs
const LOG_TAIL_LINES = 50;

@customElement('step-detail')
export class StepDetail extends LitElement {
  @property({ type: Object }) step?: PipelineStep;
  @property({ type: Object }) status?: StepStatus;
  @property({ type: String }) namespace = 'default';

  @state() private logs = '';
  @state() private logsLoading = false;
  @state() private logsError: string | null = null;
  @state() private activeTab = 0;
  @state() private events: Array<{
    type: string;
    reason: string;
    message: string;
    lastTimestamp: string;
  }> = [];
  
  // Track if this is the initial load
  private initialLogsLoad = true;
  // Track the current job name to avoid unnecessary reloads
  private currentJobName: string | null = null;
  // Polling interval for auto-refresh
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--rh-space-md, 16px);
      padding-block-end: var(--rh-space-md, 16px);
      margin-block-end: var(--rh-space-md, 16px);
      border-block-end: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .summary-label {
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: var(--rh-font-weight-body-text-medium, 500);
    }

    .summary-value {
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
    }

    .tabs {
      display: flex;
      margin-block-end: var(--rh-space-md, 16px);
      border-block-end: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .tab {
      display: inline-flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
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
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .tab:focus-visible {
      outline: var(--rh-border-width-md, 2px) solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: -2px;
    }

    .tab.active {
      color: var(--rh-color-interactive-blue-darker, #0066cc);
      border-block-end-color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .tab rh-icon {
      --rh-icon-size: 14px;
    }

    .tab-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: auto;
    }

    .logs-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .logs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-block-end: var(--rh-space-xs, 4px);
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      flex-shrink: 0;
    }

    .logs-container {
      flex: 1;
      background: var(--rh-color-gray-90, #1e1e1e);
      color: var(--rh-color-gray-10, #f0f0f0);
      border-radius: var(--rh-border-radius-default, 3px);
      padding: var(--rh-space-md, 16px);
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      white-space: pre-wrap;
      word-break: break-all;
      min-height: 200px;
      overflow: auto;
    }

    .logs-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--rh-space-sm, 8px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      font-style: italic;
      text-align: center;
      min-height: 200px;
      padding: var(--rh-space-lg, 24px);
    }

    .logs-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--rh-space-sm, 8px);
      min-height: 200px;
      padding: var(--rh-space-lg, 24px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .spec-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .spec-item {
      display: flex;
      justify-content: space-between;
      padding: var(--rh-space-sm, 8px) 0;
      border-block-end: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .spec-item:last-child {
      border-block-end: none;
    }

    .spec-key {
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
    }

    .spec-value {
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
      text-align: end;
      word-break: break-all;
      max-width: 200px;
    }

    .events-list {
      display: flex;
      flex-direction: column;
      gap: var(--rh-space-sm, 8px);
    }

    .event-item {
      padding: var(--rh-space-sm, 8px);
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
    }

    .event-header {
      display: flex;
      justify-content: space-between;
      margin-block-end: var(--rh-space-xs, 4px);
    }

    .event-type {
      font-weight: var(--rh-font-weight-body-text-medium, 500);
    }

    .event-type.normal { color: var(--rh-color-green-600, #3e8635); }
    .event-type.warning { color: var(--rh-color-yellow-600, #f0ab00); }

    .event-time {
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .event-message {
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .actions {
      display: flex;
      justify-content: space-between;
      gap: var(--rh-space-sm, 8px);
      padding-block-start: var(--rh-space-md, 16px);
      margin-block-start: var(--rh-space-md, 16px);
      border-block-start: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    // Start polling for logs every 5 seconds
    this.pollInterval = setInterval(() => {
      if (this.status?.jobName && this.activeTab === 0) {
        this.loadLogs();
      }
    }, 5000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  updated(_changedProps: Map<string, unknown>) {
    // Only reload if the job name actually changed (compare strings, not object refs)
    const newJobName = this.status?.jobName || null;
    if (newJobName !== this.currentJobName) {
      this.currentJobName = newJobName;
      this.initialLogsLoad = true;
      if (newJobName) {
        this.loadLogs();
        this.loadEvents();
      }
    }
  }

  private async loadLogs() {
    if (!this.status?.jobName) return;

    // Only show loading spinner on initial load
    if (this.initialLogsLoad) {
      this.logsLoading = true;
      this.logsError = null;
    }

    try {
      // Find the pod for this job
      const pods = await k8sClient.listPods(
        this.namespace,
        `job-name=${this.status.jobName}`
      );

      if (pods.length > 0) {
        const newLogs = await k8sClient.getPodLogs(
          this.namespace,
          pods[0].metadata.name,
          { tailLines: LOG_TAIL_LINES }
        );
        
        // Only update if logs have changed
        if (newLogs !== this.logs) {
          this.logs = newLogs;
          // Clear error on successful update
          if (this.logsError !== null) {
            this.logsError = null;
          }
        }
      } else if (this.logs !== '') {
        this.logs = '';
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to load logs';
      // Only update error if it changed
      if (this.logsError !== errorMsg) {
        this.logsError = errorMsg;
      }
    } finally {
      // Only update loading state if it changed
      if (this.logsLoading) {
        this.logsLoading = false;
      }
      this.initialLogsLoad = false;
    }
  }

  private async loadEvents() {
    if (!this.status?.jobName) return;

    try {
      const events = await k8sClient.getEvents(
        this.namespace,
        `involvedObject.name=${this.status.jobName}`
      );
      this.events = events;
    } catch (e) {
      console.warn('Failed to load events:', e);
    }
  }

  private formatDuration(): string {
    const start = this.status?.jobStatus?.startTime;
    const end = this.status?.jobStatus?.completionTime;

    if (!start) return '-';

    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;

    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  private getImage(): string {
    return this.step?.jobSpec.template.spec.containers[0]?.image || '-';
  }


  private async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }

  render() {
    if (!this.step) {
      return html`<div class="tab-content">No step selected</div>`;
    }

    return html`
      <div class="summary">
        <div class="summary-item">
          <span class="summary-label">Status</span>
          <span class="summary-value">
            <status-badge status=${this.status?.phase || 'Pending'} size="sm"></status-badge>
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Duration</span>
          <span class="summary-value">${this.formatDuration()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Job</span>
          <span class="summary-value">${this.status?.jobName || '-'}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Image</span>
          <span class="summary-value" title=${this.getImage()}>
            ${this.getImage().split('/').pop()}
          </span>
        </div>
      </div>

      <nav class="tabs" role="tablist">
        <button
          class="tab ${this.activeTab === 0 ? 'active' : ''}"
          role="tab"
          aria-selected=${this.activeTab === 0}
          @click=${() => this.activeTab = 0}
        >
          <rh-icon set="ui" icon="terminal"></rh-icon>
          Logs
        </button>
        <button
          class="tab ${this.activeTab === 1 ? 'active' : ''}"
          role="tab"
          aria-selected=${this.activeTab === 1}
          @click=${() => this.activeTab = 1}
        >
          <rh-icon set="ui" icon="list"></rh-icon>
          Spec
        </button>
        <button
          class="tab ${this.activeTab === 2 ? 'active' : ''}"
          role="tab"
          aria-selected=${this.activeTab === 2}
          @click=${() => this.activeTab = 2}
        >
          <rh-icon set="ui" icon="info-circle"></rh-icon>
          Debug
        </button>
      </nav>

      <div class="tab-content" role="tabpanel">
        ${this.renderTabContent()}
      </div>

      <footer class="actions">
        <rh-button variant="secondary" @click=${this.loadLogs}>
          <rh-icon set="ui" icon="refresh" slot="icon"></rh-icon>
          Refresh
        </rh-button>
        <rh-button variant="secondary" @click=${() => this.copyToClipboard(this.logs)}>
          <rh-icon set="ui" icon="copy" slot="icon"></rh-icon>
          Copy Logs
        </rh-button>
      </footer>
    `;
  }

  private renderTabContent() {
    switch (this.activeTab) {
      case 0:
        // Guard logs rendering - only re-render when these values change
        return guard(
          [this.logs, this.logsLoading, this.logsError],
          () => this.renderLogs()
        );
      case 1:
        return this.renderSpec();
      case 2:
        return this.renderDebug();
      default:
        return nothing;
    }
  }

  private renderLogs() {
    if (this.logsLoading) {
      return html`
        <div class="logs-loading">
          <rh-spinner size="md"></rh-spinner>
          <span>Loading logs...</span>
        </div>
      `;
    }

    if (this.logsError) {
      return html`
        <div class="logs-empty">
          <rh-icon set="ui" icon="error-filled"></rh-icon>
          Error: ${this.logsError}
        </div>
      `;
    }

    if (!this.logs) {
      return html`
        <div class="logs-empty">
          <rh-icon set="ui" icon="info-circle"></rh-icon>
          No logs available yet
        </div>
      `;
    }

    const lineCount = this.logs.split('\n').filter(l => l).length;

    return html`
      <div class="logs-wrapper">
        <div class="logs-header">
          <span>Showing last ${lineCount} line${lineCount !== 1 ? 's' : ''} (tail ${LOG_TAIL_LINES})</span>
        </div>
        <div class="logs-container">${this.logs}</div>
      </div>
    `;
  }

  private renderSpec() {
    const container = this.step?.jobSpec.template.spec.containers[0];

    return html`
      <ul class="spec-list">
        <li class="spec-item">
          <span class="spec-key">Image</span>
          <span class="spec-value">${container?.image || '-'}</span>
        </li>
        <li class="spec-item">
          <span class="spec-key">Command</span>
          <span class="spec-value">${container?.command?.join(' ') || '-'}</span>
        </li>
        <li class="spec-item">
          <span class="spec-key">Restart Policy</span>
          <span class="spec-value">${this.step?.jobSpec.template.spec.restartPolicy || 'Never'}</span>
        </li>
        <li class="spec-item">
          <span class="spec-key">Backoff Limit</span>
          <span class="spec-value">${this.step?.jobSpec.backoffLimit ?? 6}</span>
        </li>
        ${this.step?.runIf ? html`
          <li class="spec-item">
            <span class="spec-key">Run If</span>
            <span class="spec-value">
              ${this.step.runIf.condition || 'success'} of ${this.step.runIf.steps.join(', ')}
            </span>
          </li>
        ` : ''}
      </ul>
    `;
  }

  private renderDebug() {
    return html`
      <div class="events-list">
        ${this.events.length === 0 ? html`
          <div class="logs-empty">
            <rh-icon set="ui" icon="info-circle"></rh-icon>
            No events available
          </div>
        ` : this.events.map(event => html`
          <article class="event-item">
            <header class="event-header">
              <span class="event-type ${event.type.toLowerCase()}">${event.reason}</span>
              <time class="event-time">${new Date(event.lastTimestamp).toLocaleTimeString()}</time>
            </header>
            <p class="event-message">${event.message}</p>
          </article>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'step-detail': StepDetail;
  }
}
