# ---- build stage ----
FROM node:22-bookworm AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .

# give Node more heap for vite/remix build
ENV NODE_OPTIONS="--max-old-space-size=6144"
RUN pnpm run build

# Build MCP proxy server
RUN cd mcp/proxy && npm ci && npm run build

# Build MCP zoom-api server (optional - for local development)
RUN cd mcp/zoom-api && npm ci && npm run build

# ---- runtime stage ----
FROM node:22-bookworm AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

# Pre-install MCP servers globally for containerized deployments
# This avoids npx downloading packages at runtime which fails in containers
RUN npm install -g shadcn@latest @upstash/context7-mcp

COPY --from=build /app /app

RUN cat >/usr/local/bin/docker-entrypoint.sh <<'EOF'
#!/bin/sh
set -e

# Run command with node if the first argument contains a "-" or is not a system command. The last
# part inside the "{}" is a workaround for the following bug in ash/dash:
# https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=874264
if [ "${1#-}" != "${1}" ] || [ -z "$(command -v "${1}")" ] || { [ -f "${1}" ] && ! [ -x "${1}" ]; }; then
  set -- node "$@"
fi

exec "$@"
EOF
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 5173
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm","run","dockerstart"]
