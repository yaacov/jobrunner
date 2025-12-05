# JobRunner UI Dockerfile
# Multi-stage build: UBI with Bun for building, UBI nginx for production

# =============================================================================
# Build stage - UBI with Bun
# =============================================================================
FROM registry.access.redhat.com/ubi9/ubi-minimal:latest AS builder

# Install dependencies for Bun (curl-minimal is already in ubi-minimal)
RUN microdnf install -y unzip && \
    microdnf clean all

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

# Copy package files
COPY package.json bun.lock* bunfig.toml ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY src/ ./src/
COPY public/ ./public/
COPY tsconfig.json ./

# Build the application
RUN bun run build

# =============================================================================
# Production stage - UBI nginx
# =============================================================================
FROM registry.access.redhat.com/ubi9/nginx-124:latest AS production

# Switch to root to copy files
USER 0

# Copy built static files
COPY --from=builder /app/dist/ /opt/app-root/src/
COPY --from=builder /app/public/ /opt/app-root/src/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Fix permissions for OpenShift
RUN chown -R 1001:0 /opt/app-root/src && \
    chmod -R g=u /opt/app-root/src

# Switch back to non-root user
USER 1001

# Expose port (nginx listens on 8080 by default in UBI)
EXPOSE 8080

# nginx is started automatically by the UBI nginx image
CMD ["nginx", "-g", "daemon off;"]
