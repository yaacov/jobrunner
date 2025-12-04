# JobRunner UI

A visual pipeline builder and monitor for the JobRunner Kubernetes operator, built with [Lit](https://lit.dev/) web components and the [Red Hat Design System](https://ux.redhat.com/).

## Features

### Pipeline Builder
- **Visual drag-and-drop editor** for creating pipeline steps
- **Step configuration panel** with container image, script, and environment variables
- **Conditional execution** setup (runIf conditions with AND/OR operators)
- **Global settings** for namespace, service account, pod template, and shared volumes

### Pipeline Monitor
- **Pipeline list** with real-time status updates
- **Detailed pipeline view** with graph, timeline, and YAML views
- **Step details** including logs, spec, and debug information
- **Live log streaming** for running steps

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
# Navigate to the ui directory
cd ui

# Install dependencies
bun install
```

## Development

### Start the development server

```bash
# Start kubectl proxy in another terminal (if not already running)
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

### Build for production

```bash
bun run build
```

### Run production server

```bash
bun run preview
```

### Type checking

```bash
bun run typecheck
```

## License

Apache License 2.0 - See [LICENSE](../LICENSE) for details.


