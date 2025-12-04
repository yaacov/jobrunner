/**
 * Status Badge - Displays pipeline/step status with consistent styling
 * Uses RHDS rh-tag component
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PipelinePhase, StepPhase } from '../../types/pipeline.js';

type StatusType = PipelinePhase | StepPhase;
type TagColor = 'gray' | 'blue' | 'green' | 'cyan' | 'orange' | 'red' | 'purple' | 'teal';

interface StatusConfig {
  color: TagColor;
  label: string;
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  Pending: {
    color: 'gray',
    label: 'Pending',
  },
  Running: {
    color: 'cyan',
    label: 'Running',
  },
  Succeeded: {
    color: 'green',
    label: 'Succeeded',
  },
  Failed: {
    color: 'red',
    label: 'Failed',
  },
  Skipped: {
    color: 'gray',
    label: 'Skipped',
  },
  Suspended: {
    color: 'orange',
    label: 'Suspended',
  },
};

@customElement('status-badge')
export class StatusBadge extends LitElement {
  @property({ type: String }) status: StatusType = 'Pending';
  @property({ type: String }) size: 'sm' | 'md' | 'lg' = 'md';

  static styles = css`
    :host {
      display: inline-flex;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }

    .running {
      animation: pulse 1.5s ease-in-out infinite;
    }
  `;

  private getConfig(): StatusConfig {
    return STATUS_CONFIG[this.status] || STATUS_CONFIG.Pending;
  }

  render() {
    const config = this.getConfig();
    const isCompact = this.size === 'sm';
    const isRunning = this.status === 'Running';

    return html`
      <rh-tag
        ?compact=${isCompact}
        color=${config.color}
        class="${isRunning ? 'running' : ''}"
        role="status"
      >
        ${config.label}
      </rh-tag>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'status-badge': StatusBadge;
  }
}
