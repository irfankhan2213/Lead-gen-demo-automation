FROM mcr.microsoft.com/playwright:v1.61.1-focal

# Set working directory
WORKDIR /app

# Install pnpm globally (pin version 9 to support Node 20)
RUN npm install -g pnpm@9

# Copy root monorepo config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package descriptors for workspace resolution
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy codebase
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared and API packages
RUN pnpm --filter @acquisition-engine/shared build
RUN pnpm --filter @acquisition-engine/api build

# Expose server port
EXPOSE 3001

# Command to run the application
CMD ["pnpm", "--filter", "@acquisition-engine/api", "start"]
