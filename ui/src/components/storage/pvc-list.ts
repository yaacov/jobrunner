/**
 * PVC List - Displays all PersistentVolumeClaims with management
 * Following RHDS card and list patterns
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { k8sClient } from '../../lib/k8s-client.js';

interface PVC {
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  spec: {
    accessModes?: string[];
    storageClassName?: string;
    volumeMode?: string;
    resources?: { requests?: { storage?: string } };
  };
  status: { phase: string };
}

interface StorageClass {
  metadata: { name: string };
  provisioner: string;
}

type SortDirection = 'asc' | 'desc';

@customElement('pvc-list')
export class PVCList extends LitElement {
  @state() private pvcs: PVC[] = [];
  @state() private storageClasses: StorageClass[] = [];
  @state() private loading = true;
  @state() private error: string | null = null;
  @state() private namespace = 'default';
  @state() private showCreateModal = false;
  @state() private creating = false;
  @state() private createError: string | null = null;
  @state() private searchQuery = '';
  @state() private sortDirection: SortDirection = 'asc';
  @state() private currentPage = 1;
  @state() private pageSize = 10;

  // Create form state
  @state() private newPvcName = '';
  @state() private newPvcSize = '1';
  @state() private newPvcSizeUnit = 'Gi';
  @state() private newPvcVolumeMode = 'Filesystem';
  @state() private newPvcStorageClass = '';
  @state() private newPvcAccessMode = 'ReadWriteOnce';

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
      transition:
        border-color 150ms ease,
        box-shadow 150ms ease;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      box-shadow: 0 0 0 1px var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .pvc-table-container {
      background: var(--rh-color-surface-lightest, #ffffff);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
    }

    .pvc-table {
      width: 100%;
      border-collapse: collapse;
    }

    .pvc-table th,
    .pvc-table td {
      padding: var(--rh-space-md, 16px);
      text-align: start;
      border-block-end: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
    }

    .pvc-table th {
      background: var(--rh-color-surface-lighter, #f5f5f5);
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      white-space: nowrap;
    }

    .pvc-table th.sortable {
      cursor: pointer;
      user-select: none;
      transition: background-color 150ms ease;
    }

    .pvc-table th.sortable:hover {
      background: var(--rh-color-surface-light, #e0e0e0);
    }

    .pvc-table th.sortable .sort-header {
      display: inline-flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
    }

    .pvc-table th.sortable rh-icon {
      --rh-icon-size: 14px;
      opacity: 0.7;
    }

    .pvc-table tbody tr:last-child td {
      border-block-end: none;
    }

    .pvc-name-cell {
      display: flex;
      align-items: center;
      gap: var(--rh-space-sm, 8px);
    }

    .pvc-name-cell rh-tag {
      text-transform: uppercase;
      font-family: var(--rh-font-family-code, 'Red Hat Mono', monospace);
    }

    .pvc-name {
      font-weight: var(--rh-font-weight-body-text-medium, 500);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      color: var(--rh-color-text-primary-on-light, #151515);
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
      max-width: 500px;
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

    .form-group .label-hint {
      font-weight: normal;
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: var(--rh-space-sm, 8px);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      box-sizing: border-box;
    }

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      box-shadow: 0 0 0 1px var(--rh-color-interactive-blue-darker, #0066cc);
    }

    .size-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--rh-space-sm, 8px);
    }

    .size-row select {
      width: auto;
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

    .storage-class-hint {
      font-size: var(--rh-font-size-body-text-xs, 0.75rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
      margin-block-start: var(--rh-space-xs, 4px);
    }

    /* Pagination styles */
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--rh-space-md, 16px);
      border-block-start: var(--rh-border-width-sm, 1px) solid
        var(--rh-color-border-subtle-on-light, #d2d2d2);
      background: var(--rh-color-surface-lighter, #f5f5f5);
      border-radius: 0 0 var(--rh-border-radius-default, 3px) var(--rh-border-radius-default, 3px);
    }

    .pagination-info {
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: var(--rh-space-xs, 4px);
    }

    .pagination-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 var(--rh-space-sm, 8px);
      background: var(--rh-color-surface-lightest, #ffffff);
      border: var(--rh-border-width-sm, 1px) solid var(--rh-color-border-subtle-on-light, #d2d2d2);
      border-radius: var(--rh-border-radius-default, 3px);
      cursor: pointer;
      font-size: var(--rh-font-size-body-text-sm, 0.875rem);
      font-family: var(--rh-font-family-body-text, 'Red Hat Text', sans-serif);
      color: var(--rh-color-text-primary-on-light, #151515);
      transition: all 150ms ease;
    }

    .pagination-btn:hover:not(:disabled) {
      background: var(--rh-color-surface-light, #e0e0e0);
      border-color: var(--rh-color-border-strong-on-light, #8a8d90);
    }

    .pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pagination-btn.active {
      background: var(--rh-color-interactive-blue-darker, #0066cc);
      border-color: var(--rh-color-interactive-blue-darker, #0066cc);
      color: var(--rh-color-text-primary-on-dark, #ffffff);
    }

    .pagination-btn rh-icon {
      --rh-icon-size: 16px;
    }

    .pagination-ellipsis {
      padding: 0 var(--rh-space-xs, 4px);
      color: var(--rh-color-text-secondary-on-light, #6a6e73);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadData();

    // Poll for updates every 10 seconds
    this.pollInterval = setInterval(() => this.loadPVCs(), 10000);

    // Listen for namespace changes
    window.addEventListener('namespace-change', ((e: CustomEvent) => {
      this.namespace = e.detail.namespace;
      this.loadPVCs();
    }) as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private async loadData() {
    await Promise.all([this.loadPVCs(), this.loadStorageClasses()]);
  }

  private async loadPVCs() {
    try {
      this.pvcs = await k8sClient.listPVCs(this.namespace);
      this.error = null;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load PVCs';
    } finally {
      this.loading = false;
    }
  }

  private async loadStorageClasses() {
    try {
      this.storageClasses = await k8sClient.listStorageClasses();
    } catch (e) {
      console.warn('Could not load storage classes:', e);
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

  private getPhaseColor(phase: string): string {
    switch (phase) {
      case 'Bound':
        return 'green';
      case 'Pending':
        return 'orange';
      case 'Lost':
        return 'red';
      default:
        return 'gray';
    }
  }

  private get filteredPVCs(): PVC[] {
    let result = this.pvcs;

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(p => p.metadata.name.toLowerCase().includes(query));
    }

    // Sort by name
    result = [...result].sort((a, b) => {
      const comparison = a.metadata.name.localeCompare(b.metadata.name);
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }

  private get totalPages(): number {
    return Math.ceil(this.filteredPVCs.length / this.pageSize);
  }

  private get paginatedPVCs(): PVC[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredPVCs.slice(start, end);
  }

  private get paginationRange(): (number | 'ellipsis')[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const range: (number | 'ellipsis')[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) range.push(i);
    } else {
      range.push(1);
      if (current > 3) range.push('ellipsis');
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        range.push(i);
      }
      if (current < total - 2) range.push('ellipsis');
      range.push(total);
    }

    return range;
  }

  private goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  private handleSearchInput(e: Event) {
    this.searchQuery = (e.target as HTMLInputElement).value;
    this.currentPage = 1; // Reset to first page on search
  }

  private toggleSort() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  }

  private openCreateModal() {
    this.showCreateModal = true;
    this.createError = null;
    // Reset form
    this.newPvcName = '';
    this.newPvcSize = '1';
    this.newPvcSizeUnit = 'Gi';
    this.newPvcVolumeMode = 'Filesystem';
    this.newPvcStorageClass = '';
    this.newPvcAccessMode = 'ReadWriteOnce';
  }

  private closeCreateModal() {
    this.showCreateModal = false;
    this.createError = null;
  }

  private async createPVC() {
    if (!this.newPvcName.trim()) {
      this.createError = 'PVC name is required';
      return;
    }

    // Validate name (DNS subdomain name)
    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!nameRegex.test(this.newPvcName)) {
      this.createError =
        'Name must consist of lowercase alphanumeric characters or "-", and must start and end with an alphanumeric character';
      return;
    }

    this.creating = true;
    this.createError = null;

    try {
      await k8sClient.createPVC(this.namespace, {
        name: this.newPvcName.trim(),
        storageClassName: this.newPvcStorageClass || undefined,
        accessModes: [this.newPvcAccessMode],
        volumeMode: this.newPvcVolumeMode,
        storage: `${this.newPvcSize}${this.newPvcSizeUnit}`,
      });
      this.closeCreateModal();
      await this.loadPVCs();
    } catch (e) {
      this.createError = e instanceof Error ? e.message : 'Failed to create PVC';
    } finally {
      this.creating = false;
    }
  }

  private async deletePVC(pvc: PVC) {
    const confirmed = confirm(`Are you sure you want to delete PVC "${pvc.metadata.name}"?`);
    if (!confirmed) return;

    try {
      await k8sClient.deletePVC(pvc.metadata.namespace || this.namespace, pvc.metadata.name);
      await this.loadPVCs();
    } catch (err) {
      alert(`Failed to delete PVC: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading-container">
          <rh-spinner size="lg"></rh-spinner>
          <span>Loading PVCs...</span>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error-container">
          <h4>
            <rh-icon set="ui" icon="error-filled"></rh-icon>
            Error loading PVCs
          </h4>
          <p>${this.error}</p>
          <rh-button @click=${this.loadPVCs}>
            <rh-icon set="ui" icon="refresh" slot="icon"></rh-icon>
            Retry
          </rh-button>
        </div>
      `;
    }

    return html`
      <div class="header">
        <h1>Persistent Volume Claims</h1>
        <div class="controls">
          <input
            type="search"
            class="search-input"
            placeholder="Search PVCs..."
            .value=${this.searchQuery}
            @input=${this.handleSearchInput}
            aria-label="Search PVCs"
          />
          <rh-button @click=${this.openCreateModal}>
            <rh-icon set="ui" icon="add-circle" slot="icon"></rh-icon>
            Create PVC
          </rh-button>
        </div>
      </div>

      ${this.filteredPVCs.length === 0
        ? html`
            <div class="empty-state">
              <rh-icon set="standard" icon="data-science"></rh-icon>
              <h3>${this.searchQuery ? 'No matching PVCs' : 'No PVCs found'}</h3>
              <p>
                ${this.searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Create a persistent volume claim to store data.'}
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
                        >Create PVC</a
                      >
                    </rh-cta>
                  `
                : ''}
            </div>
          `
        : html`
            <div class="pvc-table-container">
              <table class="pvc-table">
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
                    <th>Status</th>
                    <th>Size</th>
                    <th>Access Mode</th>
                    <th>Volume Mode</th>
                    <th>Storage Class</th>
                    <th>Created</th>
                    <th class="actions-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.paginatedPVCs.map(pvc => this.renderPVCRow(pvc))}
                </tbody>
              </table>
              ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>
          `}
      ${this.showCreateModal ? this.renderCreateModal() : ''}
    `;
  }

  private renderPagination() {
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.filteredPVCs.length);
    const total = this.filteredPVCs.length;

    return html`
      <div class="pagination">
        <span class="pagination-info"> Showing ${start}-${end} of ${total} PVCs </span>
        <div class="pagination-controls">
          <button
            class="pagination-btn"
            @click=${() => this.goToPage(this.currentPage - 1)}
            ?disabled=${this.currentPage === 1}
            aria-label="Previous page"
          >
            <rh-icon set="ui" icon="caret-left"></rh-icon>
          </button>
          ${this.paginationRange.map(item =>
            item === 'ellipsis'
              ? html`<span class="pagination-ellipsis">...</span>`
              : html`
                  <button
                    class="pagination-btn ${item === this.currentPage ? 'active' : ''}"
                    @click=${() => this.goToPage(item)}
                    aria-label="Page ${item}"
                    aria-current=${item === this.currentPage ? 'page' : 'false'}
                  >
                    ${item}
                  </button>
                `
          )}
          <button
            class="pagination-btn"
            @click=${() => this.goToPage(this.currentPage + 1)}
            ?disabled=${this.currentPage === this.totalPages}
            aria-label="Next page"
          >
            <rh-icon set="ui" icon="caret-right"></rh-icon>
          </button>
        </div>
      </div>
    `;
  }

  private renderPVCRow(pvc: PVC) {
    return html`
      <tr>
        <td>
          <div class="pvc-name-cell">
            <rh-tag compact color="teal">pvc</rh-tag>
            <span class="pvc-name">${pvc.metadata.name}</span>
          </div>
        </td>
        <td>
          <rh-tag compact color=${this.getPhaseColor(pvc.status.phase)}>
            ${pvc.status.phase}
          </rh-tag>
        </td>
        <td>${pvc.spec.resources?.requests?.storage || '-'}</td>
        <td>${pvc.spec.accessModes?.join(', ') || '-'}</td>
        <td>${pvc.spec.volumeMode || 'Filesystem'}</td>
        <td>${pvc.spec.storageClassName || '(default)'}</td>
        <td>
          <span class="created-time">
            ${pvc.metadata.creationTimestamp
              ? this.formatTime(pvc.metadata.creationTimestamp)
              : '-'}
          </span>
        </td>
        <td class="actions-cell">
          <button
            class="delete-btn"
            @click=${() => this.deletePVC(pvc)}
            title="Delete PVC"
            aria-label="Delete ${pvc.metadata.name}"
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
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-header">
            <h2 id="modal-title">Create Persistent Volume Claim</h2>
            <button class="close-btn" @click=${this.closeCreateModal} aria-label="Close">
              <rh-icon set="ui" icon="close"></rh-icon>
            </button>
          </div>
          <div class="modal-body">
            ${this.createError ? html` <div class="form-error">${this.createError}</div> ` : ''}

            <div class="form-group">
              <label for="pvc-name">Name *</label>
              <input
                type="text"
                id="pvc-name"
                .value=${this.newPvcName}
                @input=${(e: Event) => (this.newPvcName = (e.target as HTMLInputElement).value)}
                placeholder="my-pvc"
              />
            </div>

            <div class="form-group">
              <label for="pvc-size">Size *</label>
              <div class="size-row">
                <input
                  type="number"
                  id="pvc-size"
                  min="1"
                  .value=${this.newPvcSize}
                  @input=${(e: Event) => (this.newPvcSize = (e.target as HTMLInputElement).value)}
                />
                <select
                  id="pvc-size-unit"
                  .value=${this.newPvcSizeUnit}
                  @change=${(e: Event) =>
                    (this.newPvcSizeUnit = (e.target as HTMLSelectElement).value)}
                >
                  <option value="Mi">Mi</option>
                  <option value="Gi" selected>Gi</option>
                  <option value="Ti">Ti</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="pvc-volume-mode">Volume Mode</label>
              <select
                id="pvc-volume-mode"
                .value=${this.newPvcVolumeMode}
                @change=${(e: Event) =>
                  (this.newPvcVolumeMode = (e.target as HTMLSelectElement).value)}
              >
                <option value="Filesystem" selected>Filesystem</option>
                <option value="Block">Block</option>
              </select>
            </div>

            <div class="form-group">
              <label for="pvc-access-mode">Access Mode</label>
              <select
                id="pvc-access-mode"
                .value=${this.newPvcAccessMode}
                @change=${(e: Event) =>
                  (this.newPvcAccessMode = (e.target as HTMLSelectElement).value)}
              >
                <option value="ReadWriteOnce" selected>ReadWriteOnce (RWO)</option>
                <option value="ReadOnlyMany">ReadOnlyMany (ROX)</option>
                <option value="ReadWriteMany">ReadWriteMany (RWX)</option>
                <option value="ReadWriteOncePod">ReadWriteOncePod (RWOP)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="pvc-storage-class">
                Storage Class
                <span class="label-hint">(optional)</span>
              </label>
              <select
                id="pvc-storage-class"
                .value=${this.newPvcStorageClass}
                @change=${(e: Event) =>
                  (this.newPvcStorageClass = (e.target as HTMLSelectElement).value)}
              >
                <option value="">(cluster default)</option>
                ${this.storageClasses.map(
                  sc => html` <option value=${sc.metadata.name}>${sc.metadata.name}</option> `
                )}
              </select>
              ${this.storageClasses.length === 0
                ? html` <div class="storage-class-hint">No storage classes found in cluster</div> `
                : ''}
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
            <rh-button @click=${this.createPVC} ?disabled=${this.creating}>
              ${this.creating ? 'Creating...' : 'Create PVC'}
            </rh-button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pvc-list': PVCList;
  }
}
