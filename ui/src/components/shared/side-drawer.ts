/**
 * Side Drawer - A drawer that slides in from the right
 * Used for editing step details and global settings
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('side-drawer')
export class SideDrawer extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean, reflect: true }) wide = false;
  @property({ type: String }) heading = '';
  @property({ type: Boolean }) showWidthToggle = false;

  static styles = css`
    :host {
      display: block;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      visibility: hidden;
      transition:
        opacity 200ms ease,
        visibility 200ms ease;
      z-index: 200;
    }

    :host([open]) .overlay {
      opacity: 1;
      visibility: visible;
    }

    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 400px;
      max-width: 100vw;
      background: var(--rh-color-surface-lightest, #ffffff);
      border-inline-start: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
      box-shadow: var(--rh-box-shadow-lg, -4px 0 15px rgba(0, 0, 0, 0.15));
      transform: translateX(100%);
      transition:
        transform 250ms ease,
        width 250ms ease;
      z-index: 201;
      display: flex;
      flex-direction: column;
    }

    :host([open]) .drawer {
      transform: translateX(0);
    }

    :host([wide]) .drawer {
      width: 800px;
    }

    .drawer-header {
      display: flex;
      align-items: center;
      gap: var(--rh-space-md, 16px);
      padding: var(--rh-space-md, 16px) var(--rh-space-lg, 24px);
      border-block-end: 1px solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: var(--rh-border-radius-default, 3px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }

    .close-btn:hover {
      background: var(--rh-color-surface-light, #e0e0e0);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .close-btn:focus-visible {
      outline: 2px solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 2px;
    }

    .close-btn rh-icon {
      --rh-icon-size: 20px;
    }

    .width-toggle-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: var(--rh-border-radius-default, 3px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }

    .width-toggle-btn:hover {
      background: var(--rh-color-surface-light, #e0e0e0);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .width-toggle-btn:focus-visible {
      outline: 2px solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 2px;
    }

    .width-toggle-btn.active {
      background: var(--rh-color-blue-50, #e7f1fa);
      color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .width-toggle-btn rh-icon {
      --rh-icon-size: 18px;
    }

    .drawer-title {
      flex: 1;
      margin: 0;
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      font-size: var(--rh-font-size-heading-xs, 1.125rem);
      font-weight: var(--rh-font-weight-heading-medium, 500);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .drawer-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: var(--rh-space-lg, 24px);
      overflow-y: auto;
      min-height: 0;
    }

    ::slotted(*) {
      flex: 1;
      min-height: 0;
    }

    @media (max-width: 480px) {
      .drawer {
        width: 100vw;
      }
    }
  `;

  private handleClose() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close'));
  }

  private toggleWidth() {
    this.wide = !this.wide;
  }

  private handleOverlayClick(e: Event) {
    if (e.target === e.currentTarget) {
      this.handleClose();
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.handleClose();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }

  render() {
    return html`
      <div class="overlay" @click=${this.handleOverlayClick}></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label=${this.heading}>
        <header class="drawer-header">
          <button class="close-btn" @click=${this.handleClose} aria-label="Close drawer">
            <rh-icon set="ui" icon="close"></rh-icon>
          </button>
          <h2 class="drawer-title">${this.heading}</h2>
          ${this.showWidthToggle
            ? html`
                <button
                  class="width-toggle-btn ${this.wide ? 'active' : ''}"
                  @click=${this.toggleWidth}
                  aria-label="${this.wide ? 'Collapse drawer' : 'Expand drawer'}"
                  title="${this.wide ? 'Collapse drawer' : 'Expand drawer'}"
                >
                  <rh-icon
                    set="ui"
                    icon="${this.wide ? 'caret-right' : 'caret-left'}"
                  ></rh-icon>
                </button>
              `
            : ''}
        </header>
        <div class="drawer-content">
          <slot></slot>
        </div>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'side-drawer': SideDrawer;
  }
}
