/**
 * JobRunner UI Development Server
 * Built with Bun for fast development and production serving
 */

import { existsSync } from 'fs';
import { join, extname } from 'path';

const isProduction = Bun.argv.includes('--production');
const PORT = Number(process.env.PORT) || 3000;
const K8S_API_URL = process.env.K8S_API_URL || 'http://127.0.0.1:8001';

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

/**
 * Build the application bundle
 */
async function buildApp(): Promise<boolean> {
  console.log('📦 Building application...');

  const result = await Bun.build({
    entrypoints: ['./src/main.ts'],
    outdir: './dist',
    minify: isProduction,
    sourcemap: isProduction ? 'none' : 'external',
    target: 'browser',
    splitting: false,
    external: [], // Bundle everything
  });

  if (!result.success) {
    console.error('❌ Build failed:');
    for (const log of result.logs) {
      console.error(log);
    }
    return false;
  }

  console.log('✅ Build complete');
  return true;
}

/**
 * Serve static files from public and dist directories
 */
function serveStatic(path: string): Response | null {
  const publicPath = join(import.meta.dir, '../public', path);
  const distPath = join(import.meta.dir, '../dist', path);

  // Try public directory first, then dist
  for (const filePath of [publicPath, distPath]) {
    if (existsSync(filePath)) {
      const ext = extname(path).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const file = Bun.file(filePath);

      return new Response(file, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': isProduction ? 'public, max-age=31536000' : 'no-cache',
        },
      });
    }
  }

  return null;
}

/**
 * Proxy requests to Kubernetes API
 */
async function proxyToK8s(req: Request, path: string): Promise<Response> {
  const targetUrl = `${K8S_API_URL}${path}`;

  try {
    const proxyReq = new Request(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: req.body,
    });

    const response = await fetch(proxyReq);

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`Proxy error: ${error}`);
    return new Response(JSON.stringify({ error: 'Proxy error', message: String(error) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Main server
 */
Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Proxy Kubernetes API requests
    if (path.startsWith('/api/') || path.startsWith('/apis/')) {
      return proxyToK8s(req, path + url.search);
    }

    // Serve static files
    if (path !== '/' && (path.includes('.') || path.startsWith('/node_modules/'))) {
      // Handle node_modules for RHDS elements
      if (path.startsWith('/node_modules/')) {
        const modulePath = join(import.meta.dir, '..', path);
        if (existsSync(modulePath)) {
          const ext = extname(path).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/javascript';
          const file = Bun.file(modulePath);
          return new Response(file, {
            headers: { 'Content-Type': contentType },
          });
        }
      }

      const staticResponse = serveStatic(path);
      if (staticResponse) {
        return staticResponse;
      }
    }

    // SPA fallback - serve index.html for all other routes
    const indexPath = join(import.meta.dir, '../public/index.html');
    if (existsSync(indexPath)) {
      const indexFile = Bun.file(indexPath);
      return new Response(indexFile, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  error(error) {
    console.error('Server error:', error);
    return new Response('Internal Server Error', { status: 500 });
  },
});

// Build and start
async function start() {
  const buildSuccess = await buildApp();

  if (!buildSuccess && isProduction) {
    console.error('Production build failed, exiting');
    process.exit(1);
  }

  console.log(`
🏃 JobRunner UI

   Local:   http://localhost:${PORT}
   Mode:    ${isProduction ? 'production' : 'development'}
   K8s API: ${K8S_API_URL}

${!isProduction ? '   Hot reload is not automatic. Restart the server after changes.' : ''}

   Press Ctrl+C to stop
`);
}

start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});
