# JobRunner UI

A visual pipeline builder and monitor for the JobRunner Kubernetes operator, built with [Lit](https://lit.dev/) web components and the [Red Hat Design System](https://ux.redhat.com/).

## Demo

https://github.com/yaacov/jobrunner/raw/main/docs/ui-demo.webm

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

---

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.0 or later
- Access to a Kubernetes cluster with the JobRunner operator installed
- `kubectl` configured with cluster access

### Install Dependencies

```bash
cd ui
bun install
```

### Run Development Server

```bash
# Terminal 1: Start kubectl proxy
kubectl proxy --port=8001

# Terminal 2: Start the UI
bun run dev
```

Open http://localhost:3000

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | UI server port |
| `K8S_API_URL` | `http://127.0.0.1:8001` | Kubernetes API URL |

### Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run preview` | Run production build locally |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | Run ESLint |
| `bun run format` | Format code with Prettier |

---

## Production Container

### Build

```bash
cd ui
podman build -t quay.io/yaacov/jobrunner-ui:latest .
```

### Run

```bash
# Terminal 1: Start kubectl proxy
kubectl proxy --port=8001

# Terminal 2: Run the container
podman run --rm --network=host quay.io/yaacov/jobrunner-ui:latest
```

Open http://localhost:8080

### Push

```bash
podman push quay.io/yaacov/jobrunner-ui:latest
```

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│                  Local Machine                     │
│                                                    │
│   kubectl proxy ◄───────── Container (nginx)       │
│   :8001                    :8080                   │
│       │                        │                   │
│       ▼                        │                   │
│   Kubernetes               /api/* /apis/* ─────────┘
│   API Server               /* → static files       │
│                                                    │
└────────────────────────────────────────────────────┘
                         │
                         ▼
                Browser: localhost:8080
```

## License

Apache License 2.0 - See [LICENSE](../LICENSE) for details.
