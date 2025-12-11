/**
 * Simple router using native URLPattern API
 * No external dependencies required
 */

export interface Route {
  pattern: URLPattern;
  component: string;
  name: string;
}

export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

class AppRouter {
  private routes: Route[] = [];
  private outlet: HTMLElement | null = null;
  private currentComponent: HTMLElement | null = null;

  /**
   * Initialize the router with an outlet element
   */
  init(outlet: HTMLElement): void {
    this.outlet = outlet;

    // Listen for navigation events
    window.addEventListener('popstate', () => this.navigate(window.location.pathname));

    // Handle link clicks
    document.addEventListener('click', e => {
      const link = (e.target as HTMLElement).closest('a[href]');
      if (link && link.getAttribute('href')?.startsWith('/')) {
        e.preventDefault();
        const href = link.getAttribute('href')!;
        this.go(href);
      }
    });

    // Initial navigation
    this.navigate(window.location.pathname);
  }

  /**
   * Add a route
   */
  addRoute(path: string, component: string, name?: string): void {
    // Convert path params like :namespace to named groups
    const patternPath = path.replace(/:(\w+)/g, ':$1');

    this.routes.push({
      pattern: new URLPattern({ pathname: patternPath }),
      component,
      name: name || component,
    });
  }

  /**
   * Set multiple routes at once
   */
  setRoutes(routes: Array<{ path: string; component: string; redirect?: string }>): void {
    this.routes = [];

    for (const route of routes) {
      if (route.redirect) {
        // Handle redirects by adding a special route
        this.addRoute(route.path, `__redirect:${route.redirect}`, 'redirect');
      } else {
        this.addRoute(route.path, route.component);
      }
    }
  }

  /**
   * Match a path against routes
   */
  match(path: string): RouteMatch | null {
    const url = new URL(path, window.location.origin);

    for (const route of this.routes) {
      const result = route.pattern.exec(url);
      if (result) {
        const params: Record<string, string> = {};

        // Extract pathname groups
        for (const [key, value] of Object.entries(result.pathname.groups)) {
          if (value !== undefined) {
            params[key] = value;
          }
        }

        return { route, params };
      }
    }

    return null;
  }

  /**
   * Navigate to a path
   */
  navigate(path: string): void {
    const match = this.match(path);

    if (!match) {
      console.warn(`No route matched for path: ${path}`);
      // Try to navigate to root
      if (path !== '/') {
        this.go('/');
      }
      return;
    }

    // Handle redirects
    if (match.route.component.startsWith('__redirect:')) {
      const redirectPath = match.route.component.replace('__redirect:', '');
      this.go(redirectPath);
      return;
    }

    this.renderComponent(match.route.component, match.params);
  }

  /**
   * Programmatic navigation
   */
  go(path: string): void {
    window.history.pushState({}, '', path);
    this.navigate(path);
  }

  /**
   * Render a component in the outlet
   */
  private renderComponent(componentName: string, params: Record<string, string>): void {
    if (!this.outlet) {
      console.error('Router outlet not initialized');
      return;
    }

    // Remove current component
    if (this.currentComponent) {
      this.currentComponent.remove();
    }

    // Create new component
    const component = document.createElement(componentName);

    // Pass route params as a property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).location = { params };

    // Add to outlet
    this.outlet.appendChild(component);
    this.currentComponent = component;

    // Dispatch navigation event
    window.dispatchEvent(
      new CustomEvent('router-navigate', {
        detail: { path: window.location.pathname, params, component: componentName },
      })
    );
  }

  /**
   * Get current route params
   */
  getCurrentParams(): Record<string, string> {
    const match = this.match(window.location.pathname);
    return match?.params || {};
  }
}

// Singleton instance
export const router = new AppRouter();

/**
 * Navigate to a path (convenience function)
 */
export function navigate(path: string): void {
  router.go(path);
}

/**
 * Initialize the router
 */
export function initRouter(outlet: HTMLElement): void {
  router.setRoutes([
    { path: '/', component: 'pipeline-list', redirect: '/pipelines' },
    { path: '/pipelines', component: 'pipeline-list' },
    { path: '/pipelines/:namespace/:name', component: 'pipeline-detail' },
    { path: '/builder', component: 'pipeline-canvas' },
    { path: '/builder/:namespace/:name', component: 'pipeline-canvas' },
    { path: '/storage', component: 'pvc-list' },
    { path: '/secrets', component: 'secret-list' },
  ]);

  router.init(outlet);
}
