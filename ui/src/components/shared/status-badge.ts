/**
 * Status Badge - Displays pipeline/step status with consistent styling
 * Follows RHDS badge patterns
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PipelinePhase, StepPhase } from '../../types/pipeline.js';

type StatusType = PipelinePhase | StepPhase;

interface StatusConfig {
  icon: string;
  iconSet: string;
  colorClass: string;
  label: string;
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  Pending: {
    icon: 'clock',
    iconSet: 'ui',
    colorClass: 'pending',
    label: 'Pending',
  },
  Running: {
    icon: 'in-progress',
    iconSet: 'ui',
    colorClass: 'running',
    label: 'Running',
  },
  Succeeded: {
    icon: 'check-circle',
    iconSet: 'ui',
    colorClass: 'succeeded',
    label: 'Succeeded',
  },
  Failed: {
    icon: 'error-filled',
    iconSet: 'ui',
    colorClass: 'failed',
    label: 'Failed',
  },
  Skipped: {
    icon: 'minus-circle',
    iconSet: 'ui',
    colorClass: 'skipped',
    label: 'Skipped',
  },
  Suspended: {
    icon: 'pause-circle',
    iconSet: 'ui',
    colorClass: 'suspended',
    label: 'Suspended',
  },
};

@customElement('status-badge')
export class StatusBadge extends LitElement {
  @property({ type: String }) status: StatusType = 'Pending';
  @property({ type: Boolean, attribute: 'show-icon' }) showIcon = true;
  @property({ type: String }) size: 'sm' | 'md' | 'lg' = 'md';

  static styles = css`
    :host {
      display: inline-flex;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
      padding: var(--rh-space-xs, 4px) var(--rh-space-sm, 8px);
      border-radius: var(--rh-border-radius-pill, 64px);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      white-space: nowrap;
      line-height: 1;
    }

    .badge.sm {
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      padding: 2px var(--rh-space-xs, 4px);
    }

    .badge.sm rh-icon {
      --rh-icon-size: 12px;
    }

    .badge.md {
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
    }

    .badge.md rh-icon {
      --rh-icon-size: 14px;
    }

    .badge.lg {
      font-size: var(--rh-font-size-body-text-md, 1rem);
      padding: var(--rh-space-sm, 8px) var(--rh-space-md, 16px);
    }

    .badge.lg rh-icon {
      --rh-icon-size: 18px;
    }

    /* Status colors following RHDS color patterns */
    .badge.pending {
      background: var(--rh-color-gray-20, #e0e0e0);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .badge.running {
      background: var(--rh-color-teal-100, #e0f4f4);
      color: var(--rh-color-teal-700, #005f60);
    }

    .badge.running rh-icon {
      animation: spin 1.5s linear infinite;
    }

    .badge.succeeded {
      background: var(--rh-color-green-100, #e6f4e5);
      color: var(--rh-color-green-700, #2e6a27);
    }

    .badge.failed {
      background: var(--rh-color-red-100, #fce8e6);
      color: var(--rh-color-red-700, #a30d05);
    }

    .badge.skipped {
      background: var(--rh-color-gray-20, #e0e0e0);
      color: var(--rh-color-gray-60, #6a6e73);
    }

    .badge.suspended {
      background: var(--rh-color-yellow-100, #fef3e0);
      color: var(--rh-color-yellow-700, #b8860b);
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  private getConfig(): StatusConfig {
    return STATUS_CONFIG[this.status] || STATUS_CONFIG.Pending;
  }

  render() {
    const config = this.getConfig();

    return html`
      <span class="badge ${config.colorClass} ${this.size}" role="status">
        ${this.showIcon ? html`
          <rh-icon set=${config.iconSet} icon=${config.icon}></rh-icon>
        ` : ''}
        <span>${config.label}</span>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'status-badge': StatusBadge;
  }
}
