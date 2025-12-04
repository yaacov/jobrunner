# JobRunner UI

A visual pipeline builder and monitor for the JobRunner Kubernetes operator, built with [Lit](https://lit.dev/) web components and the [Red Hat Design System](https://ux.redhat.com/).

## Features

### Pipeline Monitor
- **Pipeline list** with real-time status updates and search/sort
- **Detailed pipeline view** with graph, timeline, and YAML views
- **Step details** including logs, spec, and debug information
- **Live log streaming** for running steps
- **Copy pipeline** to builder for creating new pipelines from existing ones

### Pipeline Builder
- **Visual drag-and-drop editor** for creating pipeline steps
- **Step configuration panel** with container image, script, and environment variables
- **Conditional execution** setup (runIf conditions with AND/OR operators)
- **Global settings** for namespace, service account, pod template, and shared volumes
- **Secret mounting** as environment variables

### Storage Management
- **PVC list** with status, size, and storage class
- **Create PVCs** with configurable size, access mode, volume mode, and storage class
- **Delete PVCs** when no longer needed

### Secrets Management
- **Secret list** for Opaque secrets with search/sort
- **Create secrets** with key-value pairs
- **View and edit secrets** with masked values (toggle to reveal)
- **Delete secrets** when no longer needed

## Tech Stack

- **[Bun](https://bun.sh/)** - Fast JavaScript runtime and bundler
- **[Lit](https://lit.dev/)** - Lightweight web components library
- **[Red Hat Design System](https://ux.redhat.com/)** - Enterprise-grade UI components
- **[ELK.js](https://www.eclipse.org/elk/)** - Automatic graph layout for pipeline visualization
- **Native URLPattern API** - Client-side routing without external dependencies

## Prerequisites

- [Bun](https://bun.sh/) v1.0 or later
- Access to a Kubernetes cluster with the JobRunner operator installed
- `kubectl proxy` running (or configure `K8S_API_URL`)

## Installation

```bash
cd ui
bun install
```

## Development

### Start the development server

```bash
# Start kubectl proxy in another terminal
kubectl proxy --port=8001

# Start the UI dev server
bun run dev
```

The UI will be available at http://localhost:3000

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | UI server port |
| `K8S_API_URL` | `http://localhost:8001` | Kubernetes API URL (kubectl proxy) |

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run preview` | Run production server |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run ESLint |
| `bun run lint:fix` | Run ESLint with auto-fix |
| `bun run format` | Format code with Prettier |
| `bun run format:check` | Check code formatting |

## License

Apache License 2.0 - See [LICENSE](../LICENSE) for details.
