FROM node:22-alpine

WORKDIR /app

# Copy package definition
COPY package.json ./

# Install dependencies (if any)
RUN npm install

# Copy source code and data
COPY src ./src
COPY data ./data

# Create directory for bank wire exports
RUN mkdir -p /app/data/autonomous/wires

# Set environment to production
ENV NODE_ENV=production

# Start the daemon
CMD ["node", "src/worker.js"]
