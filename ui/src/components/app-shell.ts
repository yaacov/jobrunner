/**
 * App Shell - Main application layout component
 * Uses RHDS rh-navigation-primary with built-in hamburger toggle
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { k8sClient } from '../lib/k8s-client.js';
import { navigate } from '../lib/router.js';

@customElement('app-shell')
export class AppShell extends LitElement {
  @state() private namespace = 'default';
  @state() private namespaces: string[] = ['default'];
  @state() private currentPath = '/pipelines';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    /* Skip link for accessibility */
    .skip-link {
      position: absolute;
      left: -9999px;
      top: auto;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }

    .skip-link:focus {
      position: fixed;
      top: 0;
      left: 0;
      width: auto;
      height: auto;
      padding: var(--rh-space-md, 16px);
      background: var(--rh-color-surface-darkest, #151515);
      color: var(--rh-color-text-primary-on-dark, #ffffff);
      z-index: 1000;
    }

    /* ===== PRIMARY NAVIGATION ===== */
    rh-navigation-primary {
      --rh-navigation-primary-background-color: var(--rh-color-surface-darkest, #151515);
    }

    /* Logo styling */
    .logo {
      display: flex;
      align-items: center;
      text-decoration: none;
      color: var(--rh-color-text-primary-on-dark, #ffffff);
    }

    .logo:hover {
      text-decoration: none;
    }

    .logo-text {
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    /* ===== LAYOUT CONTAINER ===== */
    .layout {
      display: flex;
      flex: 1;
    }

    /* ===== VERTICAL SIDEBAR ===== */
    .sidebar {
      display: flex;
      flex-direction: column;
      width: 240px;
      background: var(--rh-color-surface-lightest, #ffffff);
      border-inline-end: 1px solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .sidebar-section {
      padding: var(--rh-space-md, 16px);
      border-block-end: 1px solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .sidebar-label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      margin-block-end: var(--rh-space-sm, 8px);
    }

    .namespace-select {
      width: 100%;
      padding: var(--rh-space-sm, 8px) var(--rh-space-xl, 32px) var(--rh-space-sm, 8px)
        var(--rh-space-sm, 8px);
      border: 1px solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      background: var(--rh-color-surface-lightest, #ffffff);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      font-size: 0.875rem;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236a6e73' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
    }

    .namespace-select:focus {
      outline: 2px solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 1px;
    }

    /* Navigation section */
    .nav-section {
      flex: 1;
      padding: var(--rh-space-sm, 8px) 0;
    }

    rh-navigation-vertical {
      --rh-navigation-vertical-background-color: transparent;
    }

    rh-navigation-link rh-icon {
      --rh-icon-size: 18px;
      margin-inline-end: var(--rh-space-sm, 8px);
    }

    /* ===== MAIN CONTENT ===== */
    main {
      flex: 1;
      padding: var(--rh-space-xl, 32px);
      overflow: auto;
    }

    .main-container {
      width: 100%;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 992px) {
      .sidebar {
        display: none;
      }
    }

    @media (max-width: 768px) {
      main {
        padding: var(--rh-space-md, 16px);
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadNamespaces();
    this.updateCurrentPath();

    // Listen for navigation events
    window.addEventListener('popstate', () => this.updateCurrentPath());
    window.addEventListener('router-navigate', () => this.updateCurrentPath());
  }

  private async loadNamespaces() {
    try {
      this.namespaces = await k8sClient.listNamespaces();
    } catch (e) {
      console.warn('Could not load namespaces:', e);
    }
  }

  private updateCurrentPath() {
    this.currentPath = window.location.pathname;
  }

  private isActive(path: string): boolean {
    return this.currentPath.startsWith(path);
  }

  private handleNavClick(e: Event, path: string) {
    e.preventDefault();
    navigate(path);
  }

  private handleNamespaceChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.namespace = select.value;

    // Dispatch custom event for child components
    this.dispatchEvent(
      new CustomEvent('namespace-change', {
        detail: { namespace: this.namespace },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <a href="#main-content" class="skip-link">Skip to main content</a>

      <!-- Primary Navigation -->
      <rh-navigation-primary color-palette="darkest">
        <!-- Logo -->
        <a
          slot="logo"
          href="/"
          class="logo"
          @click=${(e: Event) => this.handleNavClick(e, '/pipelines')}
        >
          <span class="logo-text">JobRunner</span>
        </a>
      </rh-navigation-primary>

      <!-- Layout: Sidebar + Main -->
      <div class="layout">
        <!-- Vertical Sidebar (desktop only) -->
        <aside class="sidebar" role="navigation">
          <!-- Namespace Selector -->
          <div class="sidebar-section">
            <span class="sidebar-label">Namespace</span>
            <select
              class="namespace-select"
              .value=${this.namespace}
              @change=${this.handleNamespaceChange}
              aria-label="Select namespace"
            >
              ${this.namespaces.map(
                ns => html` <option value=${ns} ?selected=${ns === this.namespace}>${ns}</option> `
              )}
            </select>
          </div>

          <!-- Navigation Links -->
          <div class="nav-section">
            <rh-navigation-vertical>
              <rh-navigation-link
                href="/pipelines"
                ?current-page=${this.isActive('/pipelines')}
                @click=${(e: Event) => this.handleNavClick(e, '/pipelines')}
              >
                <rh-icon set="ui" icon="monitoring" loading="eager"></rh-icon>
                Pipelines
              </rh-navigation-link>
              <rh-navigation-link
                href="/storage"
                ?current-page=${this.isActive('/storage')}
                @click=${(e: Event) => this.handleNavClick(e, '/storage')}
              >
                <rh-icon set="ui" icon="data" loading="eager"></rh-icon>
                Storage
              </rh-navigation-link>
              <rh-navigation-link
                href="/secrets"
                ?current-page=${this.isActive('/secrets')}
                @click=${(e: Event) => this.handleNavClick(e, '/secrets')}
              >
                <rh-icon set="ui" icon="lock" loading="eager"></rh-icon>
                Secrets
              </rh-navigation-link>
            </rh-navigation-vertical>
          </div>
        </aside>

        <!-- Main Content -->
        <main id="main-content" role="main">
          <div class="main-container">
            <slot></slot>
          </div>
        </main>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell;
  }
}
