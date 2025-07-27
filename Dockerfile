# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install security updates and dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Frontend build stage
FROM base AS frontend-builder
WORKDIR /app/client

# Install frontend dependencies
COPY client/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy frontend source
COPY client/ ./

# Build frontend for production
RUN npm run build

# Backend build stage
FROM base AS backend-builder
WORKDIR /app/server

# Install backend dependencies
COPY server/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy backend source
COPY server/ ./

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001

# Set working directory
WORKDIR /app

# Copy built frontend from builder stage
COPY --from=frontend-builder --chown=appuser:nodejs /app/client/dist ./client/dist

# Copy backend from builder stage
COPY --from=backend-builder --chown=appuser:nodejs /app/server ./server

# Create logs directory
RUN mkdir -p /app/logs && chown appuser:nodejs /app/logs

# Switch to non-root user
USER appuser

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/server.js"]

# Metadata
LABEL maintainer="Lab Results System"
LABEL version="1.0.0"
LABEL description="Production-ready laboratory results management system"