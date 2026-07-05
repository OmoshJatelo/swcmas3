# Use a lightweight Node.js image
FROM node:20-alpine

# Install dumb-init for graceful shutdowns
RUN apk add --no-cache dumb-init

# Set production environment
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
# We use npm ci for deterministic builds and --omit=dev to ensure no dev dependencies are installed
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Ensure appropriate permissions before switching user
RUN chown -R node:node /app

# Switch to the non-root 'node' user
USER node

# Expose the API port
EXPOSE 5000

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start the application with dumb-init and run node directly
CMD ["dumb-init", "node", "src/server.js"]