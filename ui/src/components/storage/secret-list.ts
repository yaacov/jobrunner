/**
 * Secret List - Displays all Secrets with management
 * Following RHDS card and list patterns
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { k8sClient } from '../../lib/k8s-client.js';

interface Secret {
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  type: string;
  data?: Record<string, string>;
}

interface KeyValuePair {
  key: string;
  value: string;
  revealed: boolean;
}

type SortDirection = 'asc' | 'desc';

@customElement('secret-list')
export class SecretList extends LitElement {
  @state() private secrets: Secret[] = [];
  @state() private loading = true;
  @state() private error: string | null = null;
  @state() private namespace = 'default';
  @state() private searchQuery = '';
  @state() private sortDirection: SortDirection = 'asc';

  // Create modal state
  @state() private showCreateModal = false;
  @state() private creating = false;
  @state() private createError: string | null = null;
  @state() private newSecretName = '';
  @state() private newSecretPairs: KeyValuePair[] = [{ key: '', value: '', revealed: false }];

  // View modal state
  @state() private showViewModal = false;
  @state() private viewingSecret: Secret | null = null;
  @state() private revealedKeys: Set<string> = new Set();

  // Edit modal state
  @state() private showEditModal = false;
  @state() private editingSecret: Secret | null = null;
  @state() private editSecretPairs: KeyValuePair[] = [];
  @state() private editing = false;
  @state() private editError: string | null = null;

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
      min-width: 200px;
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

    .secret-table-container {
      background: var(--rh-color-surface-lightest, #ffffff);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
    }

    .secret-table {
      width: 100%;
      border-collapse: collapse;
    }

    .secret-table th,
    .secret-table td {
      padding: var(--rh-space-md, 16px);
      text-align: start;
      border-block-end: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .secret-table th {
      background: var(--rh-color-surface-lighter, #f5f5f5);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      white-space: nowrap;
    }

    .secret-table th.sortable {
      cursor: pointer;
      user-select: none;
      transition: background-color 150ms ease;
    }

    .secret-table th.sortable:hover {
      background: var(--rh-color-surface-light, #e0e0e0);
    }

    .secret-table th.sortable .sort-header {
      display: inline-flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
    }

    .secret-table th.sortable rh-icon {
      --rh-icon-size: 14px;
      opacity: 0.7;
    }

    .secret-table tbody tr {
      cursor: pointer;
      transition: background-color 150ms ease;
    }

    .secret-table tbody tr:hover {
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .secret-table tbody tr:last-child td {
      border-block-end: none;
    }

    .secret-name-cell {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
    }

    .secret-name-cell rh-tag {
      text-transform: uppercase;
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
    }

    .secret-name {
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .keys-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--rh-space-xs, 4px);
    }

    .keys-list rh-tag {
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
    }

    .created-time {
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
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

    .actions-cell {
      width: 48px;
      text-align: center;
    }

    .delete-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: none;
      border: none;
      border-radius: var(--rh-border-radius-default, 3px);
      cursor: pointer;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }

    .delete-btn:hover {
      background: var(--rh-color-red-100, #fce8e6);
      color: var(--rh-color-red-700, #a30d05);
    }

    .delete-btn:focus-visible {
      outline: 2px solid var(--rh-color-interactive-blue-darker, #0066cc);
      outline-offset: 2px;
    }

    .delete-btn rh-icon {
      --rh-icon-size: 18px;
    }

    /* Modal styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(21, 21, 21, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: var(--rh-color-surface-lightest, #ffffff);
      border-radius: var(--rh-border-radius-default, 3px);
      box-shadow: var(--rh-box-shadow-lg, 0 10px 15px -3px rgba(21, 21, 21, 0.1));
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--rh-space-lg, 24px);
      border-block-end: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .modal-header h2 {
      margin: 0;
      font-family: var(--rh-font-family-heading, 'Red Hat Display', sans-serif);
      font-size: var(--rh-font-size-heading-md, 1.5rem);
      font-weight: var(--rh-font-weight-heading-medium, 500);
    }

    .close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: none;
      border: none;
      border-radius: var(--rh-border-radius-default, 3px);
      cursor: pointer;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      transition: background-color 150ms ease;
    }

    .close-btn:hover {
      background: var(--rh-color-surface-lighter, #f5f5f5);
    }

    .close-btn rh-icon {
      --rh-icon-size: 20px;
    }

    .modal-body {
      padding: var(--rh-space-lg, 24px);
    }

    .form-group {
      margin-block-end: var(--rh-space-md, 16px);
    }

    .form-group:last-child {
      margin-block-end: 0;
    }

    .form-group label {
      display: block;
      margin-block-end: var(--rh-space-xs, 4px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .form-group input {
      width: 100%;
      padding: var(--rh-space-sm, 8px);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      box-sizing: border-box;
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      box-shadow: 0 0 0 1px var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--rh-space-sm, 8px);
      padding: var(--rh-space-lg, 24px);
      border-block-start: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .form-error {
      padding: var(--rh-space-sm, 8px) var(--rh-space-md, 16px);
      background: var(--rh-color-red-100, #fce8e6);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-red-500, #c9190b);
      border-radius: var(--rh-border-radius-default, 3px);
      color: var(--rh-color-red-700, #a30d05);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      margin-block-end: var(--rh-space-md, 16px);
    }

    /* Key-value pairs styling */
    .kv-list {
      display: flex;
      flex-direction: column;
      gap: var(--rh-space-sm, 8px);
    }

    .kv-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto auto;
      gap: var(--rh-space-sm, 8px);
      align-items: start;
    }

    .kv-row input {
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

    .icon-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .icon-btn.danger:hover:not(:disabled) {
      background: var(--rh-color-red-100, #fce8e6);
      border-color: var(--rh-color-red-500, #c9190b);
      color: var(--rh-color-red-700, #a30d05);
    }

    .icon-btn.revealed {
      background: var(--rh-color-blue-50, #e7f1fa);
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .icon-btn rh-icon {
      --rh-icon-size: 16px;
    }

    /* View secret modal */
    .secret-data-list {
      display: flex;
      flex-direction: column;
      gap: var(--rh-space-md, 16px);
    }

    .secret-data-item {
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border-radius: var(--rh-border-radius-default, 3px);
      padding: var(--rh-space-md, 16px);
    }

    .secret-data-key {
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      color: var(--rh-color-text-primary-on-light, #151515);
      margin-block-end: var(--rh-space-sm, 8px);
    }

    .secret-data-value-row {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
    }

    .secret-data-value {
      flex: 1;
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      word-break: break-all;
      background: var(--rh-color-surface-lightest, #ffffff);
      padding: var(--rh-space-sm, 8px);
      border-radius: var(--rh-border-radius-default, 3px);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .secret-data-value.hidden {
      letter-spacing: 0.2em;
    }

    .reveal-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: var(--rh-color-surface-lightest, #ffffff);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      cursor: pointer;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      transition: all 150ms ease;
      flex-shrink: 0;
    }

    .reveal-btn:hover {
      background: var(--rh-color-surface-lighter, #f5f5f5);
      color: var(--rh-color-text-primary-on-light, #151515);
    }

    .reveal-btn.revealed {
      background: var(--rh-color-blue-50, #e7f1fa);
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      color: var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .reveal-btn rh-icon {
      --rh-icon-size: 16px;
    }

    .empty-secret {
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      font-style: italic;
    }

    .view-modal-footer {
      display: flex;
      justify-content: space-between;
      gap: var(--rh-space-sm, 8px);
      padding: var(--rh-space-lg, 24px);
      border-block-start: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .view-modal-footer .left-actions {
      display: flex;
      gap: var(--rh-space-sm, 8px);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadSecrets();

    // Poll for updates every 10 seconds
    this.pollInterval = setInterval(() => this.loadSecrets(), 10000);

    // Listen for namespace changes
    window.addEventListener('namespace-change', ((e: CustomEvent) => {
      this.namespace = e.detail.namespace;
      this.loadSecrets();
    }) as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private async loadSecrets() {
    try {
      this.secrets = await k8sClient.listSecrets(this.namespace);
      this.error = null;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load secrets';
    } finally {
      this.loading = false;
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

  private getTypeColor(type: string): string {
    switch (type) {
      case 'Opaque':
        return 'purple';
      case 'kubernetes.io/service-account-token':
        return 'blue';
      case 'kubernetes.io/dockerconfigjson':
        return 'teal';
      case 'kubernetes.io/tls':
        return 'green';
      default:
        return 'gray';
    }
  }

  private getTypeLabel(type: string): string {
    switch (type) {
      case 'Opaque':
        return 'Opaque';
      case 'kubernetes.io/service-account-token':
        return 'SA Token';
      case 'kubernetes.io/dockerconfigjson':
        return 'Docker';
      case 'kubernetes.io/tls':
        return 'TLS';
      default:
        return type.split('/').pop() || type;
    }
  }

  private decodeBase64(encoded: string): string {
    try {
      return atob(encoded);
    } catch {
      return '[decode error]';
    }
  }

  private get filteredSecrets(): Secret[] {
    let result = this.secrets;

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(s => s.metadata.name.toLowerCase().includes(query));
    }

    // Sort by name
    result = [...result].sort((a, b) => {
      const comparison = a.metadata.name.localeCompare(b.metadata.name);
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }

  private toggleSort() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  }

  // Create modal methods
  private openCreateModal() {
    this.showCreateModal = true;
    this.createError = null;
    this.newSecretName = '';
    this.newSecretPairs = [{ key: '', value: '', revealed: false }];
  }

  private closeCreateModal() {
    this.showCreateModal = false;
    this.createError = null;
  }

  private addCreateKeyValuePair() {
    this.newSecretPairs = [...this.newSecretPairs, { key: '', value: '', revealed: false }];
  }

  private removeCreateKeyValuePair(index: number) {
    this.newSecretPairs = this.newSecretPairs.filter((_, i) => i !== index);
    if (this.newSecretPairs.length === 0) {
      this.newSecretPairs = [{ key: '', value: '', revealed: false }];
    }
  }

  private updateCreateKeyValuePair(index: number, field: 'key' | 'value', value: string) {
    this.newSecretPairs = this.newSecretPairs.map((pair, i) =>
      i === index ? { ...pair, [field]: value } : pair
    );
  }

  private toggleCreateReveal(index: number) {
    this.newSecretPairs = this.newSecretPairs.map((pair, i) =>
      i === index ? { ...pair, revealed: !pair.revealed } : pair
    );
  }

  private async createSecret() {
    if (!this.newSecretName.trim()) {
      this.createError = 'Secret name is required';
      return;
    }

    // Validate name (DNS subdomain name)
    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!nameRegex.test(this.newSecretName)) {
      this.createError =
        'Name must consist of lowercase alphanumeric characters or "-", and must start and end with an alphanumeric character';
      return;
    }

    // Filter out empty pairs and validate
    const validPairs = this.newSecretPairs.filter(p => p.key.trim());
    if (validPairs.length === 0) {
      this.createError = 'At least one key-value pair is required';
      return;
    }

    // Check for duplicate keys
    const keys = validPairs.map(p => p.key.trim());
    if (new Set(keys).size !== keys.length) {
      this.createError = 'Duplicate keys are not allowed';
      return;
    }

    this.creating = true;
    this.createError = null;

    try {
      const data: Record<string, string> = {};
      for (const pair of validPairs) {
        data[pair.key.trim()] = pair.value;
      }

      await k8sClient.createSecret(this.namespace, {
        name: this.newSecretName.trim(),
        data,
      });
      this.closeCreateModal();
      await this.loadSecrets();
    } catch (e) {
      this.createError = e instanceof Error ? e.message : 'Failed to create secret';
    } finally {
      this.creating = false;
    }
  }

  // View modal methods
  private openViewModal(secret: Secret) {
    this.viewingSecret = secret;
    this.showViewModal = true;
    this.revealedKeys = new Set();
  }

  private closeViewModal() {
    this.showViewModal = false;
    this.viewingSecret = null;
    this.revealedKeys = new Set();
  }

  private toggleReveal(key: string) {
    const newSet = new Set(this.revealedKeys);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    this.revealedKeys = newSet;
  }

  // Edit modal methods
  private openEditModal(secret: Secret) {
    this.closeViewModal();
    this.editingSecret = secret;
    this.editError = null;

    // Convert secret data to key-value pairs
    const data = secret.data || {};
    this.editSecretPairs = Object.keys(data).map(key => ({
      key,
      value: this.decodeBase64(data[key]),
      revealed: false,
    }));

    if (this.editSecretPairs.length === 0) {
      this.editSecretPairs = [{ key: '', value: '', revealed: false }];
    }

    this.showEditModal = true;
  }

  private closeEditModal() {
    this.showEditModal = false;
    this.editingSecret = null;
    this.editSecretPairs = [];
    this.editError = null;
  }

  private addEditKeyValuePair() {
    this.editSecretPairs = [...this.editSecretPairs, { key: '', value: '', revealed: false }];
  }

  private removeEditKeyValuePair(index: number) {
    this.editSecretPairs = this.editSecretPairs.filter((_, i) => i !== index);
    if (this.editSecretPairs.length === 0) {
      this.editSecretPairs = [{ key: '', value: '', revealed: false }];
    }
  }

  private updateEditKeyValuePair(index: number, field: 'key' | 'value', value: string) {
    this.editSecretPairs = this.editSecretPairs.map((pair, i) =>
      i === index ? { ...pair, [field]: value } : pair
    );
  }

  private toggleEditReveal(index: number) {
    this.editSecretPairs = this.editSecretPairs.map((pair, i) =>
      i === index ? { ...pair, revealed: !pair.revealed } : pair
    );
  }

  private async saveEditSecret() {
    if (!this.editingSecret) return;

    // Filter out empty pairs and validate
    const validPairs = this.editSecretPairs.filter(p => p.key.trim());
    if (validPairs.length === 0) {
      this.editError = 'At least one key-value pair is required';
      return;
    }

    // Check for duplicate keys
    const keys = validPairs.map(p => p.key.trim());
    if (new Set(keys).size !== keys.length) {
      this.editError = 'Duplicate keys are not allowed';
      return;
    }

    this.editing = true;
    this.editError = null;

    try {
      const data: Record<string, string> = {};
      for (const pair of validPairs) {
        data[pair.key.trim()] = pair.value;
      }

      await k8sClient.updateSecret(
        this.editingSecret.metadata.namespace || this.namespace,
        this.editingSecret.metadata.name,
        data
      );
      this.closeEditModal();
      await this.loadSecrets();
    } catch (e) {
      this.editError = e instanceof Error ? e.message : 'Failed to update secret';
    } finally {
      this.editing = false;
    }
  }

  private async deleteSecret(e: Event, secret: Secret) {
    e.stopPropagation();
    const confirmed = confirm(`Are you sure you want to delete secret "${secret.metadata.name}"?`);
    if (!confirmed) return;

    try {
      await k8sClient.deleteSecret(
        secret.metadata.namespace || this.namespace,
        secret.metadata.name
      );
      await this.loadSecrets();
    } catch (err) {
      alert(`Failed to delete secret: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading-container">
          <rh-spinner size="lg"></rh-spinner>
          <span>Loading secrets...</span>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error-container">
          <h4>
            <rh-icon set="ui" icon="error-filled"></rh-icon>
            Error loading secrets
          </h4>
          <p>${this.error}</p>
          <rh-button @click=${this.loadSecrets}>
            <rh-icon set="ui" icon="sync" slot="icon"></rh-icon>
            Retry
          </rh-button>
        </div>
      `;
    }

    return html`
      <div class="header">
        <h1>Secrets</h1>
        <div class="controls">
          <input
            type="search"
            class="search-input"
            placeholder="Search secrets..."
            .value=${this.searchQuery}
            @input=${(e: Event) => (this.searchQuery = (e.target as HTMLInputElement).value)}
            aria-label="Search secrets"
          />
          <rh-button @click=${this.openCreateModal}>
            <rh-icon set="ui" icon="add-circle" slot="icon"></rh-icon>
            Create Secret
          </rh-button>
        </div>
      </div>

      ${this.filteredSecrets.length === 0
        ? html`
            <div class="empty-state">
              <rh-icon set="ui" icon="lock"></rh-icon>
              <h3>${this.searchQuery ? 'No matching secrets' : 'No secrets found'}</h3>
              <p>
                ${this.searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Create a secret to store sensitive data.'}
              </p>
              ${!this.searchQuery
                ? html`
                    <rh-cta>
                      <a
                        href="#"
                        @click=${(e: Event) => {
                          e.preventDefault();
                          this.openCreateModal();
                        }}
                        >Create Secret</a
                      >
                    </rh-cta>
                  `
                : ''}
            </div>
          `
        : html`
            <div class="secret-table-container">
              <table class="secret-table">
                <thead>
                  <tr>
                    <th class="sortable" @click=${this.toggleSort}>
                      <span class="sort-header">
                        Name
                        <rh-icon
                          set="ui"
                          icon="${this.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}"
                        ></rh-icon>
                      </span>
                    </th>
                    <th>Type</th>
                    <th>Keys</th>
                    <th>Created</th>
                    <th class="actions-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.filteredSecrets.map(secret => this.renderSecretRow(secret))}
                </tbody>
              </table>
            </div>
          `}
      ${this.showCreateModal ? this.renderCreateModal() : ''}
      ${this.showViewModal && this.viewingSecret ? this.renderViewModal() : ''}
      ${this.showEditModal && this.editingSecret ? this.renderEditModal() : ''}
    `;
  }

  private renderSecretRow(secret: Secret) {
    const keys = secret.data ? Object.keys(secret.data) : [];

    return html`
      <tr @click=${() => this.openViewModal(secret)}>
        <td>
          <div class="secret-name-cell">
            <rh-tag compact color="orange">sec</rh-tag>
            <span class="secret-name">${secret.metadata.name}</span>
          </div>
        </td>
        <td>
          <rh-tag compact color=${this.getTypeColor(secret.type)}>
            ${this.getTypeLabel(secret.type)}
          </rh-tag>
        </td>
        <td>
          <div class="keys-list">
            ${keys.length > 0
              ? keys.slice(0, 5).map(key => html` <rh-tag compact color="gray">${key}</rh-tag> `)
              : html`<span class="empty-secret">No data</span>`}
            ${keys.length > 5
              ? html` <rh-tag compact color="gray">+${keys.length - 5} more</rh-tag> `
              : ''}
          </div>
        </td>
        <td>
          <span class="created-time">
            ${secret.metadata.creationTimestamp
              ? this.formatTime(secret.metadata.creationTimestamp)
              : '-'}
          </span>
        </td>
        <td class="actions-cell">
          <button
            class="delete-btn"
            @click=${(e: Event) => this.deleteSecret(e, secret)}
            title="Delete secret"
            aria-label="Delete ${secret.metadata.name}"
          >
            <rh-icon set="ui" icon="trash"></rh-icon>
          </button>
        </td>
      </tr>
    `;
  }

  private renderCreateModal() {
    return html`
      <div
        class="modal-overlay"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.closeCreateModal();
        }}
      >
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
          <div class="modal-header">
            <h2 id="create-modal-title">Create Secret</h2>
            <button class="close-btn" @click=${this.closeCreateModal} aria-label="Close">
              <rh-icon set="ui" icon="close"></rh-icon>
            </button>
          </div>
          <div class="modal-body">
            ${this.createError ? html` <div class="form-error">${this.createError}</div> ` : ''}

            <div class="form-group">
              <label for="secret-name">Name *</label>
              <input
                type="text"
                id="secret-name"
                .value=${this.newSecretName}
                @input=${(e: Event) => (this.newSecretName = (e.target as HTMLInputElement).value)}
                placeholder="my-secret"
              />
            </div>

            <div class="form-group">
              <label>Data (Key-Value Pairs) *</label>
              <div class="kv-list">
                ${this.newSecretPairs.map(
                  (pair, index) => html`
                    <div class="kv-row">
                      <input
                        type="text"
                        placeholder="Key"
                        .value=${pair.key}
                        @input=${(e: Event) =>
                          this.updateCreateKeyValuePair(
                            index,
                            'key',
                            (e.target as HTMLInputElement).value
                          )}
                        aria-label="Key"
                      />
                      <input
                        type="${pair.revealed ? 'text' : 'password'}"
                        placeholder="Value"
                        .value=${pair.value}
                        @input=${(e: Event) =>
                          this.updateCreateKeyValuePair(
                            index,
                            'value',
                            (e.target as HTMLInputElement).value
                          )}
                        aria-label="Value"
                      />
                      <button
                        class="icon-btn ${pair.revealed ? 'revealed' : ''}"
                        @click=${() => this.toggleCreateReveal(index)}
                        title="${pair.revealed ? 'Hide value' : 'Show value'}"
                        aria-label="${pair.revealed ? 'Hide value' : 'Show value'}"
                      >
                        <rh-icon set="ui" icon="${pair.revealed ? 'view-off' : 'view'}"></rh-icon>
                      </button>
                      <button
                        class="icon-btn danger"
                        @click=${() => this.removeCreateKeyValuePair(index)}
                        title="Remove"
                        aria-label="Remove pair"
                        ?disabled=${this.newSecretPairs.length === 1}
                      >
                        <rh-icon set="ui" icon="trash"></rh-icon>
                      </button>
                    </div>
                  `
                )}
                <rh-button variant="secondary" @click=${this.addCreateKeyValuePair}>
                  <rh-icon set="ui" icon="add-circle" slot="icon"></rh-icon>
                  Add Key-Value Pair
                </rh-button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <rh-button
              variant="secondary"
              @click=${this.closeCreateModal}
              ?disabled=${this.creating}
            >
              Cancel
            </rh-button>
            <rh-button @click=${this.createSecret} ?disabled=${this.creating}>
              ${this.creating ? 'Creating...' : 'Create Secret'}
            </rh-button>
          </div>
        </div>
      </div>
    `;
  }

  private renderViewModal() {
    const secret = this.viewingSecret!;
    const data = secret.data || {};
    const keys = Object.keys(data);
    const isOpaque = secret.type === 'Opaque';

    return html`
      <div
        class="modal-overlay"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.closeViewModal();
        }}
      >
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="view-modal-title">
          <div class="modal-header">
            <h2 id="view-modal-title">${secret.metadata.name}</h2>
            <button class="close-btn" @click=${this.closeViewModal} aria-label="Close">
              <rh-icon set="ui" icon="close"></rh-icon>
            </button>
          </div>
          <div class="modal-body">
            ${keys.length === 0
              ? html` <p class="empty-secret">This secret has no data.</p> `
              : html`
                  <div class="secret-data-list">
                    ${keys.map(key => {
                      const isRevealed = this.revealedKeys.has(key);
                      const decodedValue = this.decodeBase64(data[key]);

                      return html`
                        <div class="secret-data-item">
                          <div class="secret-data-key">${key}</div>
                          <div class="secret-data-value-row">
                            <span class="secret-data-value ${isRevealed ? '' : 'hidden'}">
                              ${isRevealed ? decodedValue : '••••••••'}
                            </span>
                            <button
                              class="reveal-btn ${isRevealed ? 'revealed' : ''}"
                              @click=${() => this.toggleReveal(key)}
                              title="${isRevealed ? 'Hide value' : 'Show value'}"
                              aria-label="${isRevealed ? 'Hide value' : 'Show value'}"
                            >
                              <rh-icon
                                set="ui"
                                icon="${isRevealed ? 'view-off' : 'view'}"
                              ></rh-icon>
                            </button>
                          </div>
                        </div>
                      `;
                    })}
                  </div>
                `}
          </div>
          <div class="view-modal-footer">
            <div class="left-actions">
              ${isOpaque
                ? html`
                    <rh-button variant="secondary" @click=${() => this.openEditModal(secret)}>
                      <rh-icon set="ui" icon="edit" slot="icon"></rh-icon>
                      Edit
                    </rh-button>
                  `
                : ''}
            </div>
            <rh-button variant="secondary" @click=${this.closeViewModal}> Close </rh-button>
          </div>
        </div>
      </div>
    `;
  }

  private renderEditModal() {
    const secret = this.editingSecret!;

    return html`
      <div
        class="modal-overlay"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.closeEditModal();
        }}
      >
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
          <div class="modal-header">
            <h2 id="edit-modal-title">Edit: ${secret.metadata.name}</h2>
            <button class="close-btn" @click=${this.closeEditModal} aria-label="Close">
              <rh-icon set="ui" icon="close"></rh-icon>
            </button>
          </div>
          <div class="modal-body">
            ${this.editError ? html` <div class="form-error">${this.editError}</div> ` : ''}

            <div class="form-group">
              <label>Data (Key-Value Pairs) *</label>
              <div class="kv-list">
                ${this.editSecretPairs.map(
                  (pair, index) => html`
                    <div class="kv-row">
                      <input
                        type="text"
                        placeholder="Key"
                        .value=${pair.key}
                        @input=${(e: Event) =>
                          this.updateEditKeyValuePair(
                            index,
                            'key',
                            (e.target as HTMLInputElement).value
                          )}
                        aria-label="Key"
                      />
                      <input
                        type="${pair.revealed ? 'text' : 'password'}"
                        placeholder="Value"
                        .value=${pair.value}
                        @input=${(e: Event) =>
                          this.updateEditKeyValuePair(
                            index,
                            'value',
                            (e.target as HTMLInputElement).value
                          )}
                        aria-label="Value"
                      />
                      <button
                        class="icon-btn ${pair.revealed ? 'revealed' : ''}"
                        @click=${() => this.toggleEditReveal(index)}
                        title="${pair.revealed ? 'Hide value' : 'Show value'}"
                        aria-label="${pair.revealed ? 'Hide value' : 'Show value'}"
                      >
                        <rh-icon set="ui" icon="${pair.revealed ? 'view-off' : 'view'}"></rh-icon>
                      </button>
                      <button
                        class="icon-btn danger"
                        @click=${() => this.removeEditKeyValuePair(index)}
                        title="Remove"
                        aria-label="Remove pair"
                      >
                        <rh-icon set="ui" icon="trash"></rh-icon>
                      </button>
                    </div>
                  `
                )}
                <rh-button variant="secondary" @click=${this.addEditKeyValuePair}>
                  <rh-icon set="ui" icon="add-circle" slot="icon"></rh-icon>
                  Add Key-Value Pair
                </rh-button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <rh-button variant="secondary" @click=${this.closeEditModal} ?disabled=${this.editing}>
              Cancel
            </rh-button>
            <rh-button @click=${this.saveEditSecret} ?disabled=${this.editing}>
              ${this.editing ? 'Saving...' : 'Save Changes'}
            </rh-button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'secret-list': SecretList;
  }
}
