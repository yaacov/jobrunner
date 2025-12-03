/**
 * Step Editor - Edit step configuration
 * Following RHDS form patterns
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PipelineStep, EnvVar } from '../../types/pipeline.js';
import { validateStepName } from '../../lib/graph-layout.js';

@customElement('step-editor')
export class StepEditor extends LitElement {
  @property({ type: Object }) step?: PipelineStep;
  @property({ type: Array }) allSteps: string[] = [];

  @state() private showAdvanced = false;
  @state() private nameError: string | null = null;

  static styles = css`
    :host {
      display: block;
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

    .label-optional {
      font-weight: normal;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    input[type="text"],
    input[type="number"],
    textarea,
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
    textarea:focus,
    select:focus {
      outline: none;
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      box-shadow: 0 0 0 1px var(--rh-color-interactive-blue-darker, #0066cc);
    }

    input.error {
      border-color: var(--rh-color-red-500, #c9190b);
    }

    input.error:focus {
      box-shadow: 0 0 0 1px var(--rh-color-red-500, #c9190b);
    }

    .error-text {
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      color: var(--rh-color-red-700, #a30d05);
      margin-block-start: var(--rh-space-xs, 4px);
    }

    textarea {
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
      min-height: 120px;
      resize: vertical;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
      margin: var(--rh-space-lg, 24px) 0 var(--rh-space-md, 16px) 0;
      padding-block-end: var(--rh-space-sm, 8px);
      border-block-end: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .section-header h4 {
      margin: 0;
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      font-size: var(--rh-font-size-body-text-md, 1rem);
      font-weight: var(--rh-font-weight-heading-medium, 500);
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

    .env-row input {
      width: 100%;
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

    .toggle-btn {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
      width: 100%;
      padding: var(--rh-space-sm, 8px);
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      cursor: pointer;
      transition: all 150ms ease;
    }

    .toggle-btn:hover {
      background: var(--rh-color-surface-light, #e0e0e0);
    }

    .toggle-btn:focus-visible {
      outline: var(--rh-border-width-md, 2px) solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 2px;
    }

    .toggle-btn rh-icon {
      --rh-icon-size: 12px;
      transition: transform 150ms ease;
    }

    .toggle-btn rh-icon.open {
      transform: rotate(90deg);
    }

    .runif-section {
      padding: var(--rh-space-md, 16px);
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border-radius: var(--rh-border-radius-default, 3px);
      margin-block-start: var(--rh-space-sm, 8px);
    }

    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--rh-space-sm, 8px);
    }

    .checkbox-label {
      display: inline-flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
      padding: var(--rh-space-xs, 4px) var(--rh-space-sm, 8px);
      background: var(--rh-color-surface-lightest, #ffffff);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      cursor: pointer;
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      transition: all 150ms ease;
    }

    .checkbox-label:hover {
      background: var(--rh-color-surface-light, #e0e0e0);
    }

    .checkbox-label:has(input:checked) {
      background: var(--rh-color-blue-50, #e7f1fa);
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .checkbox-label input {
      width: auto;
      margin: 0;
    }

    .radio-group {
      display: flex;
      gap: var(--rh-space-md, 16px);
    }

    .radio-label {
      display: inline-flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      cursor: pointer;
    }

    .radio-label input {
      width: auto;
      margin: 0;
    }

    .delete-section {
      margin-block-start: var(--rh-space-xl, 32px);
      padding-block-start: var(--rh-space-lg, 24px);
      border-block-start: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }
  `;

  private getContainer() {
    return this.step?.jobSpec.template.spec.containers[0];
  }

  private dispatchUpdate(updates: Partial<PipelineStep>) {
    this.dispatchEvent(new CustomEvent('update', { detail: updates }));
  }

  private updateName(name: string) {
    const validation = validateStepName(name);
    this.nameError = validation.valid ? null : validation.error || null;
    this.dispatchUpdate({ name });
  }

  private updateImage(image: string) {
    if (!this.step) return;

    const containers = [...(this.step.jobSpec.template.spec.containers || [])];
    if (containers.length > 0) {
      containers[0] = { ...containers[0], image };
    }

    this.dispatchUpdate({
      jobSpec: {
        ...this.step.jobSpec,
        template: {
          ...this.step.jobSpec.template,
          spec: {
            ...this.step.jobSpec.template.spec,
            containers,
          },
        },
      },
    });
  }

  private updateCommand(commandStr: string) {
    if (!this.step) return;

    // Parse command string into array (split by spaces, respecting quotes would be ideal but keeping simple)
    const command = commandStr.trim() ? commandStr.split(/\s+/) : [];

    const containers = [...(this.step.jobSpec.template.spec.containers || [])];
    if (containers.length > 0) {
      containers[0] = {
        ...containers[0],
        command,
      };
    }

    this.dispatchUpdate({
      jobSpec: {
        ...this.step.jobSpec,
        template: {
          ...this.step.jobSpec.template,
          spec: {
            ...this.step.jobSpec.template.spec,
            containers,
          },
        },
      },
    });
  }

  private updateArgs(argsStr: string) {
    if (!this.step) return;

    // Each line becomes an arg, or if single line treat as single arg
    const lines = argsStr.split('\n').filter(l => l.trim());
    const args = lines.length > 0 ? lines : [];

    const containers = [...(this.step.jobSpec.template.spec.containers || [])];
    if (containers.length > 0) {
      containers[0] = {
        ...containers[0],
        args,
      };
    }

    this.dispatchUpdate({
      jobSpec: {
        ...this.step.jobSpec,
        template: {
          ...this.step.jobSpec.template,
          spec: {
            ...this.step.jobSpec.template.spec,
            containers,
          },
        },
      },
    });
  }

  private getEnvVars(): EnvVar[] {
    return this.getContainer()?.env || [];
  }

  private updateEnvVars(envVars: EnvVar[]) {
    if (!this.step) return;

    const containers = [...(this.step.jobSpec.template.spec.containers || [])];
    if (containers.length > 0) {
      containers[0] = { ...containers[0], env: envVars };
    }

    this.dispatchUpdate({
      jobSpec: {
        ...this.step.jobSpec,
        template: {
          ...this.step.jobSpec.template,
          spec: {
            ...this.step.jobSpec.template.spec,
            containers,
          },
        },
      },
    });
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

  private updateRunIf(field: string, value: unknown) {
    if (!this.step) return;

    const runIf = this.step.runIf || { steps: [] };

    this.dispatchUpdate({
      runIf: { ...runIf, [field]: value },
    });
  }

  private toggleRunIfStep(stepName: string) {
    if (!this.step) return;

    const currentSteps = this.step.runIf?.steps || [];
    const newSteps = currentSteps.includes(stepName)
      ? currentSteps.filter(s => s !== stepName)
      : [...currentSteps, stepName];

    if (newSteps.length === 0) {
      // Remove runIf entirely
      this.dispatchUpdate({ runIf: undefined });
    } else {
      this.updateRunIf('steps', newSteps);
    }
  }

  private dispatchDelete() {
    this.dispatchEvent(new CustomEvent('delete'));
  }

  render() {
    if (!this.step) {
      return html`<p>No step selected</p>`;
    }

    const container = this.getContainer();
    const command = container?.command?.join(' ') || '';
    const args = container?.args?.join('\n') || '';
    const envVars = this.getEnvVars();
    const otherSteps = this.allSteps.filter(s => s !== this.step?.name);

    return html`
      <!-- Name -->
      <div class="form-group">
        <label for="step-name">Step Name *</label>
        <input
          type="text"
          id="step-name"
          class="${this.nameError ? 'error' : ''}"
          .value=${this.step.name}
          @input=${(e: Event) => this.updateName((e.target as HTMLInputElement).value)}
          aria-describedby=${this.nameError ? 'name-error' : ''}
          aria-invalid=${this.nameError ? 'true' : 'false'}
        />
        ${this.nameError ? html`
          <div id="name-error" class="error-text" role="alert">${this.nameError}</div>
        ` : ''}
      </div>

      <!-- Image -->
      <div class="form-group">
        <label for="step-image">Container Image</label>
        <input
          type="text"
          id="step-image"
          .value=${container?.image || ''}
          @input=${(e: Event) => this.updateImage((e.target as HTMLInputElement).value)}
          placeholder="e.g., registry.access.redhat.com/ubi9/ubi-minimal:latest"
        />
      </div>

      <!-- Command -->
      <div class="form-group">
        <label for="step-command">Command</label>
        <input
          type="text"
          id="step-command"
          .value=${command}
          @input=${(e: Event) => this.updateCommand((e.target as HTMLInputElement).value)}
          placeholder="e.g., sh -c  or  python -c  or  kubectl"
        />
      </div>

      <!-- Arguments -->
      <div class="form-group">
        <label for="step-args">Arguments <span class="label-optional">(one per line)</span></label>
        <textarea
          id="step-args"
          .value=${args}
          @input=${(e: Event) => this.updateArgs((e.target as HTMLTextAreaElement).value)}
          placeholder="echo 'Hello World'"
        ></textarea>
      </div>

      <!-- Environment Variables -->
      <div class="section-header">
        <rh-icon set="ui" icon="list"></rh-icon>
        <h4>Environment Variables</h4>
      </div>
      <div class="env-list">
        ${envVars.map((env, index) => html`
          <div class="env-row">
            <input
              type="text"
              placeholder="Name"
              .value=${env.name}
              @input=${(e: Event) => this.updateEnvVar(index, 'name', (e.target as HTMLInputElement).value)}
              aria-label="Variable name"
            />
            <input
              type="text"
              placeholder="Value"
              .value=${env.value || ''}
              @input=${(e: Event) => this.updateEnvVar(index, 'value', (e.target as HTMLInputElement).value)}
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
        `)}
        <rh-button variant="secondary" @click=${this.addEnvVar}>
          <rh-icon set="ui" icon="add-circle" slot="icon"></rh-icon>
          Add Variable
        </rh-button>
      </div>

      <!-- Conditional Execution -->
      ${otherSteps.length > 0 ? html`
        <div class="section-header">
          <rh-icon set="ui" icon="link"></rh-icon>
          <h4>Conditional Execution</h4>
          <span class="label-optional">(optional)</span>
        </div>
        <div class="runif-section">
          <div class="form-group">
            <label>Run after these steps:</label>
            <div class="checkbox-group">
              ${otherSteps.map(stepName => html`
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    ?checked=${this.step?.runIf?.steps?.includes(stepName)}
                    @change=${() => this.toggleRunIfStep(stepName)}
                  />
                  ${stepName}
                </label>
              `)}
            </div>
          </div>

          ${this.step.runIf?.steps?.length ? html`
            <div class="form-group">
              <label>Condition:</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input
                    type="radio"
                    name="condition"
                    value="success"
                    ?checked=${(this.step.runIf?.condition || 'success') === 'success'}
                    @change=${() => this.updateRunIf('condition', 'success')}
                  />
                  On Success
                </label>
                <label class="radio-label">
                  <input
                    type="radio"
                    name="condition"
                    value="fail"
                    ?checked=${this.step.runIf?.condition === 'fail'}
                    @change=${() => this.updateRunIf('condition', 'fail')}
                  />
                  On Failure
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>Operator:</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input
                    type="radio"
                    name="operator"
                    value="and"
                    ?checked=${(this.step.runIf?.operator || 'and') === 'and'}
                    @change=${() => this.updateRunIf('operator', 'and')}
                  />
                  ALL (AND)
                </label>
                <label class="radio-label">
                  <input
                    type="radio"
                    name="operator"
                    value="or"
                    ?checked=${this.step.runIf?.operator === 'or'}
                    @change=${() => this.updateRunIf('operator', 'or')}
                  />
                  ANY (OR)
                </label>
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Advanced Settings -->
      <button
        class="toggle-btn"
        style="margin-block-start: var(--rh-space-lg, 24px)"
        @click=${() => this.showAdvanced = !this.showAdvanced}
        aria-expanded=${this.showAdvanced}
      >
        <rh-icon set="ui" icon="caret-right" class=${this.showAdvanced ? 'open' : ''}></rh-icon>
        Advanced Settings
      </button>

      ${this.showAdvanced ? html`
        <div style="margin-block-start: var(--rh-space-md, 16px)">
          <div class="form-group">
            <label for="backoff-limit">Backoff Limit</label>
            <input
              type="number"
              id="backoff-limit"
              min="0"
              .value=${String(this.step.jobSpec.backoffLimit ?? 6)}
              @input=${(e: Event) => {
                const value = parseInt((e.target as HTMLInputElement).value) || 6;
                this.dispatchUpdate({
                  jobSpec: { ...this.step!.jobSpec, backoffLimit: value },
                });
              }}
            />
          </div>

          <div class="form-group">
            <label for="active-deadline">Active Deadline (seconds)</label>
            <input
              type="number"
              id="active-deadline"
              min="0"
              .value=${String(this.step.jobSpec.activeDeadlineSeconds || '')}
              placeholder="No limit"
              @input=${(e: Event) => {
                const value = parseInt((e.target as HTMLInputElement).value);
                this.dispatchUpdate({
                  jobSpec: {
                    ...this.step!.jobSpec,
                    activeDeadlineSeconds: value || undefined,
                  },
                });
              }}
            />
          </div>
        </div>
      ` : ''}

      <!-- Delete -->
      <div class="delete-section">
        <rh-button variant="danger" @click=${this.dispatchDelete}>
          <rh-icon set="ui" icon="trash" slot="icon"></rh-icon>
          Delete Step
        </rh-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'step-editor': StepEditor;
  }
}
