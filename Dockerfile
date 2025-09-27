# Multi-stage Dockerfile for backend API only
# Build stage (if we later add TypeScript or build steps)
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install only production dependencies first (leveraging Docker layer caching)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Use npm by default (adjust if lockfiles differ)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; \
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --prod; \
    elif [ -f yarn.lock ]; then yarn install --production; \
    else npm install --omit=dev; fi

# Copy source (only backend)
COPY src ./src
# Expose port (matches PORT env default 4000)
EXPOSE 4000

# Note: skipping optional documentation COPY steps to avoid build failures when
# those files are not present in the remote build context. Keep docs in the
# repository root for local development, but do not rely on copying them into
# the container image.

# No Docker-level HEALTHCHECK: platform-level health checks are handled by
# Fly configuration (fly.toml). Avoid container-level healthchecks which can
# cause additional restarts during deployment cycles.

# Default environment
ENV NODE_ENV=production

# Start command
CMD ["node", "src/index.js"]
