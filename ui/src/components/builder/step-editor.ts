/**
 * Step Editor - Edit step configuration
 * Following RHDS form patterns
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PipelineStep, EnvVar, EnvFromSource } from '../../types/pipeline.js';
import { validateStepName } from '../../lib/graph-layout.js';
import { k8sClient } from '../../lib/k8s-client.js';
import type { EditorLanguage } from '../shared/code-editor.js';

interface SecretInfo {
  name: string;
  keys: string[];
}

@customElement('step-editor')
export class StepEditor extends LitElement {
  @property({ type: Object }) step?: PipelineStep;
  @property({ type: Array }) allSteps: string[] = [];
  @property({ type: String }) namespace = 'default';

  @state() private nameError: string | null = null;
  @state() private showAdvanced = false;
  @state() private availableSecrets: SecretInfo[] = [];
  @state() private loadingSecrets = false;
  @state() private editorLanguage: EditorLanguage = 'bash';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      min-height: 0;
      box-sizing: border-box;
    }

    .form-group {
      margin-block-end: var(--rh-space-md, 16px);
      width: 100%;
      box-sizing: border-box;
    }

    .form-group.flex-grow {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .form-group.flex-grow textarea {
      flex: 1;
      min-height: 200px;
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

    input[type='text'],
    input[type='number'],
    textarea,
    select {
      width: 100%;
      padding: var(--rh-space-sm, 8px);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      transition: border-color 150ms ease;
      box-sizing: border-box;
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
      border-block-end: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
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

    /* Custom accordion styling */
    .accordion {
      margin-block-start: var(--rh-space-lg, 24px);
      width: 100%;
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      overflow: hidden;
      box-sizing: border-box;
    }

    .accordion-header {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
      width: 100%;
      padding: var(--rh-space-sm, 8px) var(--rh-space-md, 16px);
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border: none;
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      color: var(--rh-color-text-primary-on-light, #151515);
      cursor: pointer;
      text-align: left;
    }

    .accordion-header:hover {
      background: var(--rh-color-surface-light, #e0e0e0);
    }

    .accordion-header:focus {
      outline: none;
    }

    .accordion-header .chevron {
      display: inline-block;
      width: 0;
      height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-left: 6px solid currentColor;
      transition: transform 150ms ease;
    }

    .accordion-header .chevron.open {
      transform: rotate(90deg);
    }

    .accordion-content {
      padding: var(--rh-space-md, 16px);
      border-block-start: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .accordion-content .form-group {
      margin-block-end: var(--rh-space-md, 16px);
    }

    .accordion-content .form-group:last-child {
      margin-block-end: 0;
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

    .actions-section {
      display: flex;
      justify-content: space-between;
      gap: var(--rh-space-md, 16px);
      margin-block-start: var(--rh-space-xl, 32px);
      padding-block-start: var(--rh-space-lg, 24px);
      border-block-start: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .secret-selector-row {
      display: flex;
      gap: var(--rh-space-sm, 8px);
      align-items: stretch;
    }

    .secret-selector-row select {
      flex: 1;
    }

    .secret-selector-row .icon-btn {
      flex-shrink: 0;
    }

    .secret-selector-row .icon-btn.loading {
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

    .secret-selector-row .icon-btn.loading rh-icon {
      animation: spin 1s linear infinite;
    }

    .envfrom-list {
      display: flex;
      flex-direction: column;
      gap: var(--rh-space-sm, 8px);
    }

    .envfrom-item {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
      padding: var(--rh-space-sm, 8px);
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border-radius: var(--rh-border-radius-default, 3px);
    }

    .envfrom-item rh-tag {
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
    }

    .envfrom-item .secret-name {
      flex: 1;
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.fetchSecrets();

    // Listen for namespace changes
    window.addEventListener('namespace-change', this.handleNamespaceChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('namespace-change', this.handleNamespaceChange);
  }

  updated(changedProperties: Map<string, unknown>) {
    // Auto-detect language when step changes
    if (changedProperties.has('step') && this.step) {
      this.editorLanguage = this.detectLanguageFromCommand();
    }
  }

  private handleNamespaceChange = ((e: CustomEvent) => {
    this.namespace = e.detail.namespace;
    this.fetchSecrets();
  }) as EventListener;

  private async fetchSecrets() {
    this.loadingSecrets = true;
    try {
      const secrets = await k8sClient.listSecrets(this.namespace);
      // Only show Opaque secrets (user-created, not system secrets)
      this.availableSecrets = secrets
        .filter(s => s.type === 'Opaque')
        .map(s => ({
          name: s.metadata.name,
          keys: s.data ? Object.keys(s.data) : [],
        }));
    } catch (error) {
      console.error('Failed to fetch secrets:', error);
      this.availableSecrets = [];
    } finally {
      this.loadingSecrets = false;
    }
  }

  private getContainer() {
    return this.step?.jobSpec.template.spec.containers[0];
  }

  private isScriptMode(): boolean {
    const command = this.getContainer()?.command || [];
    return command.length > 0 && command[command.length - 1] === '-c';
  }

  private detectLanguageFromCommand(): EditorLanguage {
    const command = this.getContainer()?.command || [];
    const commandStr = command.join(' ').toLowerCase();

    if (commandStr.includes('python')) return 'python';
    if (commandStr.includes('node') || commandStr.includes('javascript')) return 'javascript';
    if (
      commandStr.includes('sh') ||
      commandStr.includes('bash') ||
      commandStr.includes('kubectl')
    )
      return 'bash';

    return 'bash'; // Default to bash
  }

  private handleEditorLanguageChange(e: CustomEvent) {
    this.editorLanguage = e.detail.language;
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

    const container = this.getContainer();
    const command = container?.command || [];

    // Check if command ends with -c (e.g., "sh -c" or "python -c")
    // In this case, the entire script should be a single argument
    const isScriptMode = command.length > 0 && command[command.length - 1] === '-c';

    let args: string[];
    if (isScriptMode) {
      // For script mode, keep the entire text as a single argument (preserving newlines)
      const script = argsStr.trim();
      args = script ? [script] : [];
    } else {
      // Otherwise, each line becomes a separate arg
      const lines = argsStr.split('\n').filter(l => l.trim());
      args = lines.length > 0 ? lines : [];
    }

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

  private getEnvFrom(): EnvFromSource[] {
    return this.getContainer()?.envFrom || [];
  }

  private updateEnvFrom(envFrom: EnvFromSource[]) {
    if (!this.step) return;

    const containers = [...(this.step.jobSpec.template.spec.containers || [])];
    if (containers.length > 0) {
      containers[0] = {
        ...containers[0],
        envFrom: envFrom.length > 0 ? envFrom : undefined,
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

  private addSecretEnvFrom(secretName: string) {
    if (!secretName) return;

    const currentEnvFrom = this.getEnvFrom();
    // Check if already added
    if (currentEnvFrom.some(e => e.secretRef?.name === secretName)) return;

    const newEnvFrom: EnvFromSource[] = [...currentEnvFrom, { secretRef: { name: secretName } }];
    this.updateEnvFrom(newEnvFrom);
  }

  private removeSecretEnvFrom(secretName: string) {
    const currentEnvFrom = this.getEnvFrom();
    const newEnvFrom = currentEnvFrom.filter(e => e.secretRef?.name !== secretName);
    this.updateEnvFrom(newEnvFrom);
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

  private dispatchClose() {
    this.dispatchEvent(new CustomEvent('close'));
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
        ${this.nameError
          ? html` <div id="name-error" class="error-text" role="alert">${this.nameError}</div> `
          : ''}
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

      <!-- Arguments / Script -->
      <div class="form-group flex-grow">
        <label for="step-args">
          ${this.isScriptMode() ? 'Script' : 'Arguments'}
          <span class="label-optional"
            >${this.isScriptMode() ? '(passed as single argument to -c)' : '(one per line)'}</span
          >
        </label>
        <code-editor
          .value=${args}
          .language=${this.editorLanguage}
          .showLanguageSelector=${this.isScriptMode()}
          .minHeight=${'200px'}
          @change=${(e: CustomEvent) => this.updateArgs(e.detail.value)}
          @language-change=${this.handleEditorLanguageChange}
        ></code-editor>
      </div>

      <!-- Environment Variables -->
      <div class="section-header">
        <rh-icon set="ui" icon="list"></rh-icon>
        <h4>Environment Variables</h4>
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

      <!-- Conditional Execution -->
      ${otherSteps.length > 0
        ? html`
            <div class="section-header">
              <rh-icon set="ui" icon="link"></rh-icon>
              <h4>Conditional Execution</h4>
              <span class="label-optional">(optional)</span>
            </div>
            <div class="runif-section">
              <div class="form-group">
                <label>Run after these steps:</label>
                <div class="checkbox-group">
                  ${otherSteps.map(
                    stepName => html`
                      <label class="checkbox-label">
                        <input
                          type="checkbox"
                          ?checked=${this.step?.runIf?.steps?.includes(stepName)}
                          @change=${() => this.toggleRunIfStep(stepName)}
                        />
                        ${stepName}
                      </label>
                    `
                  )}
                </div>
              </div>

              ${this.step.runIf?.steps?.length
                ? html`
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
                  `
                : ''}
            </div>
          `
        : ''}

      <!-- Advanced Settings -->
      <div class="accordion">
        <button
          class="accordion-header"
          @click=${() => (this.showAdvanced = !this.showAdvanced)}
          aria-expanded=${this.showAdvanced}
        >
          <span class="chevron ${this.showAdvanced ? 'open' : ''}"></span>
          Advanced Settings
        </button>

        ${this.showAdvanced
          ? html`
              <div class="accordion-content">
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

                <div class="form-group">
                  <label for="secret-envfrom">
                    Secret as Environment Variables
                    <span class="label-optional">(mount all keys from a secret)</span>
                  </label>
                  <div class="secret-selector-row">
                    ${this.loadingSecrets
                      ? html`
                          <select id="secret-envfrom" disabled>
                            <option>Loading secrets...</option>
                          </select>
                        `
                      : html`
                          <select
                            id="secret-envfrom"
                            @change=${(e: Event) => {
                              const value = (e.target as HTMLSelectElement).value;
                              if (value) {
                                this.addSecretEnvFrom(value);
                                (e.target as HTMLSelectElement).value = '';
                              }
                            }}
                          >
                            <option value="">-- Select a secret to add --</option>
                            ${this.availableSecrets
                              .filter(
                                s => !this.getEnvFrom().some(e => e.secretRef?.name === s.name)
                              )
                              .map(
                                secret => html`
                                  <option value=${secret.name}>
                                    ${secret.name} (${secret.keys.length} keys)
                                  </option>
                                `
                              )}
                          </select>
                        `}
                    <button
                      class="icon-btn ${this.loadingSecrets ? 'loading' : ''}"
                      @click=${() => this.fetchSecrets()}
                      title="Refresh secrets list"
                      aria-label="Refresh secrets list"
                      ?disabled=${this.loadingSecrets}
                    >
                      <rh-icon set="ui" icon="sync"></rh-icon>
                    </button>
                  </div>
                  ${this.getEnvFrom().filter(e => e.secretRef).length > 0
                    ? html`
                        <div class="envfrom-list" style="margin-top: var(--rh-space-sm, 8px);">
                          ${this.getEnvFrom()
                            .filter(e => e.secretRef)
                            .map(
                              envFrom => html`
                                <div class="envfrom-item">
                                  <rh-tag compact color="orange">sec</rh-tag>
                                  <span class="secret-name">${envFrom.secretRef!.name}</span>
                                  <button
                                    class="icon-btn danger"
                                    @click=${() =>
                                      this.removeSecretEnvFrom(envFrom.secretRef!.name)}
                                    title="Remove secret"
                                    aria-label="Remove ${envFrom.secretRef!.name}"
                                  >
                                    <rh-icon set="ui" icon="trash"></rh-icon>
                                  </button>
                                </div>
                              `
                            )}
                        </div>
                      `
                    : ''}
                </div>
              </div>
            `
          : ''}
      </div>

      <!-- Actions -->
      <div class="actions-section">
        <rh-button variant="danger" @click=${this.dispatchDelete}>
          <rh-icon set="ui" icon="trash" slot="icon"></rh-icon>
          Delete Step
        </rh-button>
        <rh-button variant="secondary" @click=${this.dispatchClose}>
          <rh-icon set="ui" icon="close" slot="icon"></rh-icon>
          Close
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
