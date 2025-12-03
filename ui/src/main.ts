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

// ============================================
// Custom Components
// ============================================
import './components/app-shell.js';
import './components/shared/status-badge.js';
import './components/shared/side-drawer.js';
import './components/monitor/pipeline-list.js';
import './components/monitor/pipeline-detail.js';
import './components/monitor/step-detail.js';
import './components/builder/pipeline-canvas.js';
import './components/builder/step-editor.js';
import './components/builder/global-settings.js';

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

