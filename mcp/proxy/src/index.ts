import { app } from './server.js';
import { processManager } from './processManager.js';

const PORT = process.env.MCP_PROXY_PORT || 3100;

// Graceful shutdown handling
async function shutdown() {
  console.log('\n[MCP Proxy] Shutting down...');
  await processManager.closeAll();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
app.listen(PORT, () => {
  console.log('============================================================');
  console.log('  MCP Proxy Server');
  console.log('============================================================');
  console.log(`  Port: ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    POST   /api/spawn             - Start a stdio MCP server');
  console.log('    GET    /api/sessions          - List active sessions');
  console.log('    GET    /api/tools/:sessionId  - Get tools for session');
  console.log('    GET    /api/tools/server/:name - Get tools by server name');
  console.log('    POST   /api/execute/:sessionId - Execute tool');
  console.log('    POST   /api/execute/server/:name - Execute tool by server');
  console.log('    DELETE /api/close/:sessionId  - Close session');
  console.log('    DELETE /api/close/server/:name - Close by server name');
  console.log('============================================================');
  console.log('');
});
