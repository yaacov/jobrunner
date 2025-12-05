/**
 * Code Editor - A CodeMirror-based editor with syntax highlighting
 * Supports multiple languages: bash, python, yaml, javascript
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  StreamLanguage,
  foldGutter,
  indentOnInput,
  bracketMatching,
  foldKeymap,
} from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { yaml } from '@codemirror/lang-yaml';
import { shell } from '@codemirror/legacy-modes/mode/shell';

export type EditorLanguage = 'bash' | 'python' | 'yaml' | 'javascript' | 'text';

const languageLabels: Record<EditorLanguage, string> = {
  bash: 'Bash/Shell',
  python: 'Python',
  yaml: 'YAML',
  javascript: 'JavaScript',
  text: 'Plain Text',
};

@customElement('code-editor')
export class CodeEditor extends LitElement {
  @property({ type: String }) value = '';
  @property({ type: String }) language: EditorLanguage = 'bash';
  @property({ type: String }) placeholder = '';
  @property({ type: Boolean }) readonly = false;
  @property({ type: Boolean }) showLanguageSelector = true;
  @property({ type: String }) minHeight = '150px';

  @state() private editorView?: EditorView;

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .editor-container {
      display: flex;
      flex-direction: column;
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      overflow: hidden;
      background: var(--rh-color-surface-lightest, #ffffff);
    }

    .editor-container:focus-within {
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      box-shadow: 0 0 0 1px var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .editor-toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: var(--rh-space-xs, 4px) var(--rh-space-sm, 8px);
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border-block-end: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
      gap: var(--rh-space-sm, 8px);
    }

    .language-select {
      padding: var(--rh-space-xs, 4px) var(--rh-space-sm, 8px);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      background: var(--rh-color-surface-lightest, #ffffff);
      cursor: pointer;
    }

    .language-select:focus {
      outline: none;
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .editor-wrapper {
      flex: 1;
      min-height: var(--editor-min-height, 150px);
    }

    .cm-editor {
      height: 100%;
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
    }

    .cm-editor.cm-focused {
      outline: none;
    }

    .cm-scroller {
      overflow: auto;
    }

    .cm-content {
      padding: var(--rh-space-sm, 8px) 0;
    }

    .cm-line {
      padding: 0 var(--rh-space-sm, 8px);
    }

    .cm-gutters {
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border-inline-end: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .cm-activeLineGutter {
      background: var(--rh-color-surface-light, #e0e0e0);
    }

    .cm-activeLine {
      background: rgba(0, 102, 204, 0.05);
    }

    /* Fold gutter styling */
    .cm-foldGutter {
      width: 16px;
    }

    .cm-foldGutter .cm-gutterElement {
      cursor: pointer;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      padding: 0 2px;
      transition: color 150ms ease;
    }

    .cm-foldGutter .cm-gutterElement:hover {
      color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .cm-foldPlaceholder {
      background: var(--rh-color-surface-light, #e0e0e0);
      border: none;
      padding: 0 4px;
      border-radius: 2px;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      cursor: pointer;
    }

    .cm-foldPlaceholder:hover {
      background: var(--rh-color-blue-50, #e7f1fa);
      color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    /* Syntax highlighting colors */
    .cm-editor .cm-content {
      caret-color: var(--rh-color-text-primary-on-light, #151515);
    }

    .cm-editor .cm-cursor {
      border-left-color: var(--rh-color-text-primary-on-light, #151515);
    }

    .cm-editor .cm-selectionBackground,
    .cm-editor.cm-focused .cm-selectionBackground {
      background: rgba(0, 102, 204, 0.2);
    }
  `;

  private getLanguageExtension() {
    switch (this.language) {
      case 'python':
        return python();
      case 'javascript':
        return javascript();
      case 'yaml':
        return yaml();
      case 'bash':
        return StreamLanguage.define(shell);
      case 'text':
      default:
        return [];
    }
  }

  private createEditorState() {
    return EditorState.create({
      doc: this.value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
        syntaxHighlighting(defaultHighlightStyle),
        this.getLanguageExtension(),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            if (newValue !== this.value) {
              this.value = newValue;
              this.dispatchEvent(
                new CustomEvent('change', {
                  detail: { value: newValue },
                  bubbles: true,
                  composed: true,
                })
              );
            }
          }
        }),
        EditorState.readOnly.of(this.readonly),
        EditorView.theme({
          '&': {
            minHeight: this.minHeight,
          },
        }),
      ],
    });
  }

  private initEditor() {
    const wrapper = this.shadowRoot?.querySelector('.editor-wrapper');
    if (!wrapper) return;

    // Clean up existing editor
    if (this.editorView) {
      this.editorView.destroy();
    }

    this.editorView = new EditorView({
      state: this.createEditorState(),
      parent: wrapper as HTMLElement,
    });
  }

  firstUpdated() {
    this.style.setProperty('--editor-min-height', this.minHeight);
    this.initEditor();
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('language')) {
      // Recreate editor with new language
      this.initEditor();
    }

    if (changedProperties.has('value') && this.editorView) {
      const currentValue = this.editorView.state.doc.toString();
      if (currentValue !== this.value) {
        this.editorView.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: this.value,
          },
        });
      }
    }

    if (changedProperties.has('minHeight')) {
      this.style.setProperty('--editor-min-height', this.minHeight);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.editorView) {
      this.editorView.destroy();
    }
  }

  private handleLanguageChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.language = select.value as EditorLanguage;
    this.dispatchEvent(
      new CustomEvent('language-change', {
        detail: { language: this.language },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="editor-container">
        ${this.showLanguageSelector
          ? html`
              <div class="editor-toolbar">
                <select
                  class="language-select"
                  .value=${this.language}
                  @change=${this.handleLanguageChange}
                  aria-label="Select language"
                >
                  ${Object.entries(languageLabels).map(
                    ([value, label]) => html`
                      <option value=${value} ?selected=${value === this.language}>${label}</option>
                    `
                  )}
                </select>
              </div>
            `
          : ''}
        <div class="editor-wrapper"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'code-editor': CodeEditor;
  }
}
