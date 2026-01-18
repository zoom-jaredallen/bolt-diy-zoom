#!/usr/bin/env node
/**
 * Zoom API MCP Server - Entry Point
 * 
 * Supports both stdio and HTTP transports:
 * - stdio: Default, for local MCP clients (Claude Desktop, etc.)
 * - http: For remote hosting (use --http flag)
 * 
 * Usage:
 *   npx @zoom/mcp-api-server          # stdio mode
 *   npx @zoom/mcp-api-server --http   # HTTP mode (port 3001)
 */

import { runStdioServer } from './server.js';

// Check for HTTP mode flag
const isHttpMode = process.argv.includes('--http');

async function main(): Promise<void> {
  if (isHttpMode) {
    // HTTP mode - for remote hosting
    console.error('HTTP mode not yet implemented. Use stdio mode for now.');
    console.error('For remote hosting, deploy behind a reverse proxy that converts HTTP to stdio.');
    process.exit(1);
  } else {
    // stdio mode - default
    await runStdioServer();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
