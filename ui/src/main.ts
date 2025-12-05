/**
 * JobRunner UI - Main Entry Point
 *
 * A pipeline builder and monitor for Kubernetes using
 * Red Hat Design System components.
 */

// ============================================
// RHDS Elements - Import all components via main entry
// ============================================
import '@rhds/elements';
import { RhIcon } from '@rhds/elements/rh-icon/rh-icon.js';

// ============================================
// Configure Icon Resolver
// Icons are loaded dynamically from node_modules
// ============================================
RhIcon.resolve = async (set: string, icon: string): Promise<Node> => {
  try {
    const response = await fetch(`/node_modules/@rhds/icons/${set}/${icon}.js`);
    if (!response.ok) {
      console.warn(`Icon not found: ${set}/${icon}`);
      return createFallbackIcon();
    }
    const text = await response.text();
    // Extract the SVG from the module's template.innerHTML
    // Format: const t = document.createElement('template');t.innerHTML=`<svg...>`;export default t.content.cloneNode(true);
    const match = text.match(/innerHTML\s*=\s*`([\s\S]*?)`/);
    if (match) {
      const template = document.createElement('template');
      template.innerHTML = match[1].trim();
      return template.content.cloneNode(true);
    }
    console.warn(`Could not parse icon: ${set}/${icon}`);
    return createFallbackIcon();
  } catch (e) {
    console.warn(`Error loading icon ${set}/${icon}:`, e);
    return createFallbackIcon();
  }
};

// Create a fallback icon (empty placeholder) when icon loading fails
function createFallbackIcon(): Node {
  const template = document.createElement('template');
  template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"></svg>`;
  return template.content.cloneNode(true);
}

// ============================================
// Force Eager Icon Loading
// Override the loading property to always return 'eager'
// This fixes lazy loading issues in production (including Shadow DOM)
// ============================================
Object.defineProperty(RhIcon.prototype, 'loading', {
  get() {
    return 'eager';
  },
  set() {
    // Ignore any attempts to set loading - always use eager
  },
  configurable: true,
});

// ============================================
// Custom Components
// ============================================
import './components/app-shell.js';
import './components/shared/status-badge.js';
import './components/shared/side-drawer.js';
import './components/shared/code-editor.js';
import './components/monitor/pipeline-list.js';
import './components/monitor/pipeline-detail.js';
import './components/monitor/step-detail.js';
import './components/builder/pipeline-canvas.js';
import './components/builder/step-editor.js';
import './components/builder/global-settings.js';
import './components/storage/pvc-list.js';
import './components/storage/secret-list.js';

// ============================================
// Router Setup
// ============================================
import { initRouter } from './lib/router.js';

// Initialize app when DOM is ready
function initApp() {
  const app = document.getElementById('app');

  if (!app) {
    console.error('App container not found');
    return;
  }

  // Remove loading state
  app.classList.remove('app-loading');
  app.innerHTML = '';

  // Create app shell with router outlet
  const shell = document.createElement('app-shell');
  const outlet = document.createElement('div');
  outlet.id = 'router-outlet';
  shell.appendChild(outlet);
  app.appendChild(shell);

  // Initialize router
  initRouter(outlet);

  console.log('🏃 JobRunner UI initialized');
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
