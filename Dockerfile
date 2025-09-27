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
COPY SENSAY_API_GUIDE.md ./
COPY AUTH_API_DOCS.md ./
COPY PROTECTED_ROUTES.md ./
COPY MONGODB_SETUP.md ./

# Expose port (matches PORT env default 4000)
EXPOSE 4000

# Healthcheck (basic TCP)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT||4000) + '/health', r=>{if(r.statusCode!==200)process.exit(1)})" || exit 1

# Default environment
ENV NODE_ENV=production

# Start command
CMD ["node", "src/index.js"]
