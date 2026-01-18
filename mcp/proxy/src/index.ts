import { app } from './server.js';
import { processManager } from './processManager.js';
import { initializeZoomApiAdapter, isZoomApiAvailable } from './zoomApiAdapter.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const VERSION = packageJson.version;

const PORT = process.env.MCP_PROXY_PORT || 3100;

// Graceful shutdown handling
async function shutdown() {
  console.log('\n[MCP Proxy] Shutting down...');
  await processManager.closeAll();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Initialize and start server
async function main() {
  // Initialize built-in servers
  await initializeZoomApiAdapter();

  // Start server
  app.listen(PORT, () => {
    console.log('============================================================');
    console.log(`  MCP Proxy Server v${VERSION}`);
    console.log('============================================================');
    console.log(`  Port: ${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/health`);
    console.log('');
    console.log('  Stdio Proxy Endpoints:');
    console.log('    POST   /api/spawn              - Start a stdio MCP server');
    console.log('    GET    /api/sessions           - List active sessions');
    console.log('    GET    /api/tools/:sessionId   - Get tools for session');
    console.log('    POST   /api/execute/:sessionId - Execute tool');
    console.log('    DELETE /api/close/:sessionId   - Close session');
    console.log('');
    console.log('  Built-in MCP Servers:');
    console.log(`    Zoom API: ${isZoomApiAvailable() ? '✓ Available' : '✗ Not available'}`);
    console.log('    GET  /mcp/zoom-api/tools     - List Zoom API tools');
    console.log('    POST /mcp/zoom-api/execute   - Execute Zoom API tool');
    console.log('    GET  /mcp/zoom-api/categories - List API categories');
    console.log('    GET  /mcp/zoom-api/search?q=  - Search endpoints');
    console.log('============================================================');
    console.log('');
  });
}

main().catch((error) => {
  console.error('[MCP Proxy] Failed to start:', error);
  process.exit(1);
});
