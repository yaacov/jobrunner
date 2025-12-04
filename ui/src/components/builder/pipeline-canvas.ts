/**
 * Pipeline Canvas - Visual pipeline builder with drag-and-drop
 * Following RHDS patterns for cards and interactions
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Pipeline, PipelineStep } from '../../types/pipeline.js';
import { k8sClient } from '../../lib/k8s-client.js';
import { navigate } from '../../lib/router.js';
import {
  createEmptyPipeline,
  createDefaultStep,
  validateStepName,
} from '../../lib/graph-layout.js';

interface CanvasStep extends PipelineStep {
  x: number;
  y: number;
}

@customElement('pipeline-canvas')
export class PipelineCanvas extends LitElement {
  @state() private pipeline: Pipeline = createEmptyPipeline('new-pipeline');
  @state() private canvasSteps: CanvasStep[] = [];
  @state() private selectedStep: string | null = null;
  @state() private showStepEditor = false;
  @state() private showGlobalSettings = false;
  @state() private saving = false;
  @state() private error: string | null = null;
  @state() private draggedStepIndex: number | null = null;
  @state() private existingPipelineNames: Set<string> = new Set();
  @state() private nameError: string | null = null;

  static styles = css`
    :host {
      display: block;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
      padding: var(--rh-space-md, 16px);
      background: var(--rh-color-red-100, #fce8e6);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-red-500, #c9190b);
      border-radius: var(--rh-border-radius-default, 3px);
      color: var(--rh-color-red-700, #a30d05);
      margin-block-end: var(--rh-space-lg, 24px);
    }

    .error-banner rh-icon {
      --rh-icon-size: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-block-end: var(--rh-space-xl, 32px);
      flex-wrap: wrap;
      gap: var(--rh-space-md, 16px);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: var(--rh-space-md, 16px);
    }

    .pipeline-name-group {
      display: flex;
      flex-direction: column;
      gap: var(--rh-space-xs, 4px);
    }

    .pipeline-name-label {
      display: flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .required-indicator {
      color: var(--rh-color-red-500, #c9190b);
      font-weight: var(--rh-font-weight-body-text-bold, 700);
    }

    .pipeline-name-input {
      padding: var(--rh-space-sm, 8px);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-md, 1rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      font-weight: normal;
      min-width: 250px;
      transition: border-color 150ms ease;
    }

    .pipeline-name-input:focus {
      outline: none;
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      box-shadow: 0 0 0 1px var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .pipeline-name-input.error {
      border-color: var(--rh-color-red-500, #c9190b);
    }

    .pipeline-name-input.error:focus {
      box-shadow: 0 0 0 1px var(--rh-color-red-500, #c9190b);
    }

    .name-error-text {
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      color: var(--rh-color-red-700, #a30d05);
    }

    .header-actions {
      display: flex;
      gap: var(--rh-space-sm, 8px);
    }

    .workspace {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: var(--rh-space-lg, 24px);
      min-height: 600px;
    }

    @media (max-width: 900px) {
      .workspace {
        grid-template-columns: 1fr;
      }
    }

    .sidebar {
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      padding: var(--rh-space-lg, 24px);
    }

    .sidebar h3 {
      margin: 0 0 var(--rh-space-md, 16px) 0;
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-weight: var(--rh-font-weight-heading-medium, 500);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .step-templates {
      display: flex;
      flex-direction: column;
      gap: var(--rh-space-sm, 8px);
    }

    .step-template {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
      padding: var(--rh-space-md, 16px);
      background: var(--rh-color-surface-lightest, #ffffff);
      border: var(--rh-border-width-sm, 1px) dashed var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      cursor: grab;
      transition: all 150ms ease;
    }

    .step-template:hover {
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      background: var(--rh-color-blue-50, #e7f1fa);
    }

    .step-template:active {
      cursor: grabbing;
    }

    .step-template:focus-visible {
      outline: var(--rh-border-width-md, 2px) solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 2px;
    }

    .step-template-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border-radius: var(--rh-border-radius-default, 3px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .step-template-icon rh-icon {
      --rh-icon-size: 20px;
    }

    .step-template-info h4 {
      margin: 0;
      font-size: var(--rh-font-size-body-text-md, 1rem);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
    }

    .step-template-info p {
      margin: 0;
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .canvas {
      background: var(--rh-color-surface-lightest, #ffffff);
      border: 2px dashed var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      padding: var(--rh-space-lg, 24px);
      min-height: 500px;
      position: relative;
      transition:
        border-color 150ms ease,
        background-color 150ms ease;
    }

    .canvas.drag-over {
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      background: var(--rh-color-blue-50, #e7f1fa);
    }

    .canvas-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      text-align: center;
      gap: var(--rh-space-md, 16px);
    }

    .canvas-empty rh-icon {
      --rh-icon-size: 48px;
      color: var(--rh-color-gray-40, #8a8d90);
    }

    .steps-list {
      display: flex;
      flex-direction: column;
      gap: var(--rh-space-md, 16px);
    }

    .step-card {
      display: flex;
      align-items: center;
      gap: var(--rh-space-md, 16px);
      padding: var(--rh-space-md, 16px);
      background: var(--rh-color-surface-lightest, #ffffff);
      border: 2px solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      cursor: pointer;
      transition: all 150ms ease;
    }

    .step-card:hover {
      box-shadow: var(--rh-box-shadow-md, 0 4px 6px -1px rgba(21, 21, 21, 0.1));
    }

    .step-card:focus-visible {
      outline: var(--rh-border-width-md, 2px) solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 2px;
    }

    .step-card.selected {
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .step-card.dragging {
      opacity: 0.5;
    }

    .step-drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      padding: var(--rh-space-xs, 4px);
    }

    .step-drag-handle:active {
      cursor: grabbing;
    }

    .step-drag-handle rh-icon {
      --rh-icon-size: 16px;
    }

    .step-info {
      flex: 1;
    }

    .step-name {
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      margin-block-end: 2px;
    }

    .step-image {
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .step-actions {
      display: flex;
      gap: var(--rh-space-xs, 4px);
    }

    .step-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--rh-space-xs, 4px);
      background: none;
      border: none;
      cursor: pointer;
      border-radius: var(--rh-border-radius-default, 3px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }

    .step-action-btn:hover {
      background: var(--rh-color-surface-lighter, #f5f5f5);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .step-action-btn:focus-visible {
      outline: var(--rh-border-width-md, 2px) solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 2px;
    }

    .step-action-btn.delete:hover {
      background: var(--rh-color-red-100, #fce8e6);
      color: var(--rh-color-red-700, #a30d05);
    }

    .step-action-btn rh-icon {
      --rh-icon-size: 16px;
    }

    .step-connector {
      display: flex;
      justify-content: center;
      padding: var(--rh-space-xs, 4px) 0;
    }

    .step-connector-line {
      width: 2px;
      height: 20px;
      background: var(--rh-color-border-subtle-on-light, #d2d2d2);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadExistingPipelines();
  }

  private async loadExistingPipelines() {
    try {
      const namespace = this.pipeline.metadata.namespace || 'default';
      const pipelines = await k8sClient.listPipelines(namespace);
      this.existingPipelineNames = new Set(pipelines.map(p => p.metadata.name));

      // Generate a unique name
      const baseName = 'new-pipeline';
      let uniqueName = baseName;
      let counter = 1;

      while (this.existingPipelineNames.has(uniqueName)) {
        counter++;
        uniqueName = `${baseName}-${counter}`;
      }

      this.pipeline = {
        ...this.pipeline,
        metadata: {
          ...this.pipeline.metadata,
          name: uniqueName,
        },
      };
    } catch (e) {
      // If we can't load pipelines, just use default name
      console.warn('Failed to load existing pipelines:', e);
    }
  }

  private validatePipelineName(name: string): string | null {
    const validation = validateStepName(name);
    if (!validation.valid) {
      return validation.error || 'Invalid name';
    }
    if (this.existingPipelineNames.has(name)) {
      return `A pipeline named "${name}" already exists in this namespace`;
    }
    return null;
  }

  private updatePipelineName(name: string) {
    this.nameError = this.validatePipelineName(name);
    this.pipeline = {
      ...this.pipeline,
      metadata: {
        ...this.pipeline.metadata,
        name,
      },
    };
  }

  private getStepImage(step: PipelineStep): string {
    return step.jobSpec.template.spec.containers[0]?.image || 'default';
  }

  private addStep(type: 'bash' | 'python' | 'kubectl' | 'custom') {
    const stepNumber = this.canvasSteps.length + 1;
    const name = `step-${stepNumber}`;

    const newStep = createDefaultStep(name);
    const container = newStep.jobSpec.template.spec.containers[0];

    // Customize based on type
    switch (type) {
      case 'bash':
        container.image = 'registry.access.redhat.com/ubi9/ubi-minimal:latest';
        container.command = ['sh', '-c'];
        container.args = ['echo "Hello from bash step"'];
        break;
      case 'python':
        container.image = 'registry.access.redhat.com/ubi9/python-311:latest';
        container.command = ['python', '-c'];
        container.args = ['print("Hello from Python step")'];
        break;
      case 'kubectl':
        container.image = 'bitnami/kubectl:latest';
        container.command = ['sh', '-c'];
        container.args = ['kubectl version --client'];
        break;
      case 'custom':
        container.image = '';
        container.command = [];
        container.args = [];
        break;
    }

    const canvasStep: CanvasStep = {
      ...newStep,
      x: 100,
      y: this.canvasSteps.length * 120 + 50,
    };

    this.canvasSteps = [...this.canvasSteps, canvasStep];
    this.updatePipelineFromCanvas();
    this.selectedStep = name;
    this.showStepEditor = true;
  }

  private removeStep(name: string) {
    this.canvasSteps = this.canvasSteps.filter(s => s.name !== name);
    this.updatePipelineFromCanvas();

    if (this.selectedStep === name) {
      this.selectedStep = null;
      this.showStepEditor = false;
    }
  }

  private selectStep(name: string) {
    this.selectedStep = name;
    this.showStepEditor = true;
    this.showGlobalSettings = false;
  }

  private closeDrawer() {
    this.showStepEditor = false;
    this.showGlobalSettings = false;
    this.selectedStep = null;
  }

  private updatePipelineFromCanvas() {
    this.pipeline = {
      ...this.pipeline,
      spec: {
        ...this.pipeline.spec,
        steps: this.canvasSteps.map(({ x: _x, y: _y, ...step }) => step),
      },
    };
  }

  private updateStep(name: string, updates: Partial<PipelineStep>) {
    this.canvasSteps = this.canvasSteps.map(step =>
      step.name === name ? { ...step, ...updates } : step
    );
    this.updatePipelineFromCanvas();
  }

  private handleDragStart(e: DragEvent, index: number) {
    this.draggedStepIndex = index;
    (e.target as HTMLElement).classList.add('dragging');
  }

  private handleDragEnd(e: DragEvent) {
    this.draggedStepIndex = null;
    (e.target as HTMLElement).classList.remove('dragging');
  }

  private handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (this.draggedStepIndex === null || this.draggedStepIndex === index) return;

    const steps = [...this.canvasSteps];
    const [draggedStep] = steps.splice(this.draggedStepIndex, 1);
    steps.splice(index, 0, draggedStep);

    this.canvasSteps = steps;
    this.draggedStepIndex = index;
    this.updatePipelineFromCanvas();
  }

  private handleCanvasDragOver(e: DragEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.add('drag-over');
  }

  private handleCanvasDragLeave(e: DragEvent) {
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
  }

  private handleCanvasDrop(e: DragEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drag-over');

    // Check if dropping a template
    const templateType = e.dataTransfer?.getData('template-type');
    if (templateType) {
      this.addStep(templateType as 'bash' | 'python' | 'kubectl' | 'custom');
    }
  }

  private handleTemplateDragStart(e: DragEvent, type: string) {
    e.dataTransfer?.setData('template-type', type);
  }

  private async savePipeline() {
    // Validate name
    const nameValidationError = this.validatePipelineName(this.pipeline.metadata.name);
    if (nameValidationError) {
      this.nameError = nameValidationError;
      this.error = `Pipeline name: ${nameValidationError}`;
      return;
    }

    if (this.canvasSteps.length === 0) {
      this.error = 'Pipeline must have at least one step';
      return;
    }

    this.saving = true;
    this.error = null;

    try {
      const namespace = this.pipeline.metadata.namespace || 'default';
      await k8sClient.createPipeline(namespace, this.pipeline);
      navigate(`/monitor/${namespace}/${this.pipeline.metadata.name}`);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save pipeline';
    } finally {
      this.saving = false;
    }
  }

  render() {
    return html`
      ${this.error
        ? html`
            <div class="error-banner" role="alert">
              <rh-icon set="ui" icon="error-filled"></rh-icon>
              ${this.error}
            </div>
          `
        : ''}

      <header class="header">
        <div class="header-left">
          <div class="pipeline-name-group">
            <label class="pipeline-name-label" for="pipeline-name">
              Pipeline Name <span class="required-indicator">*</span>
            </label>
            <input
              type="text"
              id="pipeline-name"
              class="pipeline-name-input ${this.nameError ? 'error' : ''}"
              .value=${this.pipeline.metadata.name}
              @input=${(e: Event) => this.updatePipelineName((e.target as HTMLInputElement).value)}
              placeholder="my-pipeline"
              required
              aria-required="true"
              aria-invalid=${this.nameError ? 'true' : 'false'}
              aria-describedby=${this.nameError ? 'name-error' : ''}
            />
            ${this.nameError
              ? html`
                  <span id="name-error" class="name-error-text" role="alert"
                    >${this.nameError}</span
                  >
                `
              : ''}
          </div>
        </div>
        <div class="header-actions">
          <rh-button
            variant="secondary"
            @click=${() => {
              this.showGlobalSettings = true;
              this.showStepEditor = false;
            }}
          >
            <rh-icon set="ui" icon="configure" slot="icon"></rh-icon>
            Settings
          </rh-button>
          <rh-button ?disabled=${this.saving} @click=${this.savePipeline}>
            <rh-icon set="ui" icon="save" slot="icon"></rh-icon>
            ${this.saving ? 'Saving...' : 'Save Pipeline'}
          </rh-button>
        </div>
      </header>

      <div class="workspace">
        <!-- Left sidebar - Step templates -->
        <aside class="sidebar">
          <h3>Add Step</h3>
          <div class="step-templates">
            <div
              class="step-template"
              draggable="true"
              tabindex="0"
              role="button"
              @dragstart=${(e: DragEvent) => this.handleTemplateDragStart(e, 'bash')}
              @click=${() => this.addStep('bash')}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this.addStep('bash');
                }
              }}
            >
              <span class="step-template-icon">
                <rh-icon set="standard" icon="command-line"></rh-icon>
              </span>
              <div class="step-template-info">
                <h4>Bash Runner</h4>
                <p>UBI Minimal</p>
              </div>
            </div>

            <div
              class="step-template"
              draggable="true"
              tabindex="0"
              role="button"
              @dragstart=${(e: DragEvent) => this.handleTemplateDragStart(e, 'python')}
              @click=${() => this.addStep('python')}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this.addStep('python');
                }
              }}
            >
              <span class="step-template-icon">
                <rh-icon set="ui" icon="code"></rh-icon>
              </span>
              <div class="step-template-info">
                <h4>Python Runner</h4>
                <p>UBI Python 3.11</p>
              </div>
            </div>

            <div
              class="step-template"
              draggable="true"
              tabindex="0"
              role="button"
              @dragstart=${(e: DragEvent) => this.handleTemplateDragStart(e, 'kubectl')}
              @click=${() => this.addStep('kubectl')}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this.addStep('kubectl');
                }
              }}
            >
              <span class="step-template-icon">
                <rh-icon set="ui" icon="kubernetes-service"></rh-icon>
              </span>
              <div class="step-template-info">
                <h4>Kubectl Step</h4>
                <p>Kubernetes CLI</p>
              </div>
            </div>

            <div
              class="step-template"
              draggable="true"
              tabindex="0"
              role="button"
              @dragstart=${(e: DragEvent) => this.handleTemplateDragStart(e, 'custom')}
              @click=${() => this.addStep('custom')}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this.addStep('custom');
                }
              }}
            >
              <span class="step-template-icon">
                <rh-icon set="ui" icon="puzzle-piece"></rh-icon>
              </span>
              <div class="step-template-info">
                <h4>Custom Step</h4>
                <p>Set your own image</p>
              </div>
            </div>
          </div>
        </aside>

        <!-- Center - Canvas -->
        <div
          class="canvas"
          @dragover=${this.handleCanvasDragOver}
          @dragleave=${this.handleCanvasDragLeave}
          @drop=${this.handleCanvasDrop}
        >
          ${this.canvasSteps.length === 0
            ? html`
                <div class="canvas-empty">
                  <rh-icon set="standard" icon="data-science"></rh-icon>
                  <p>Drag steps here or click to add</p>
                </div>
              `
            : html`
                <div class="steps-list" role="list">
                  ${this.canvasSteps.map(
                    (step, index) => html`
                      ${index > 0
                        ? html`
                            <div class="step-connector" aria-hidden="true">
                              <div class="step-connector-line"></div>
                            </div>
                          `
                        : ''}
                      <article
                        class="step-card ${this.selectedStep === step.name ? 'selected' : ''}"
                        role="listitem"
                        tabindex="0"
                        draggable="true"
                        @dragstart=${(e: DragEvent) => this.handleDragStart(e, index)}
                        @dragend=${this.handleDragEnd}
                        @dragover=${(e: DragEvent) => this.handleDragOver(e, index)}
                        @click=${() => this.selectStep(step.name)}
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this.selectStep(step.name);
                          }
                        }}
                      >
                        <span class="step-drag-handle" aria-label="Drag to reorder">
                          <rh-icon set="ui" icon="grip-horizontal"></rh-icon>
                        </span>
                        <div class="step-info">
                          <div class="step-name">${step.name}</div>
                          <div class="step-image">${this.getStepImage(step)}</div>
                        </div>
                        <div class="step-actions">
                          <button
                            class="step-action-btn"
                            title="Edit step"
                            aria-label="Edit ${step.name}"
                            @click=${(e: Event) => {
                              e.stopPropagation();
                              this.selectStep(step.name);
                            }}
                          >
                            <rh-icon set="ui" icon="edit"></rh-icon>
                          </button>
                          <button
                            class="step-action-btn delete"
                            title="Delete step"
                            aria-label="Delete ${step.name}"
                            @click=${(e: Event) => {
                              e.stopPropagation();
                              this.removeStep(step.name);
                            }}
                          >
                            <rh-icon set="ui" icon="trash"></rh-icon>
                          </button>
                        </div>
                      </article>
                    `
                  )}
                </div>
              `}
        </div>
      </div>

      <!-- Side Drawer for Global Settings -->
      <side-drawer
        ?open=${this.showGlobalSettings}
        heading="Pipeline Settings"
        @close=${this.closeDrawer}
      >
        <global-settings
          .pipeline=${this.pipeline}
          @update=${(e: CustomEvent) => {
            this.pipeline = e.detail.pipeline;
          }}
        ></global-settings>
      </side-drawer>

      <!-- Side Drawer for Step Editor -->
      <side-drawer
        ?open=${this.showStepEditor && !!this.selectedStep}
        heading="Edit Step"
        @close=${this.closeDrawer}
      >
        ${this.selectedStep
          ? html`
              <step-editor
                .step=${this.canvasSteps.find(s => s.name === this.selectedStep)}
                .allSteps=${this.canvasSteps.map(s => s.name)}
                .namespace=${this.pipeline.metadata.namespace || 'default'}
                @update=${(e: CustomEvent) => this.updateStep(this.selectedStep!, e.detail)}
                @delete=${() => {
                  this.removeStep(this.selectedStep!);
                  this.closeDrawer();
                }}
                @close=${this.closeDrawer}
              ></step-editor>
            `
          : ''}
      </side-drawer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pipeline-canvas': PipelineCanvas;
  }
}
