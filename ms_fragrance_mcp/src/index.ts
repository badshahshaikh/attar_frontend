import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { BackendClient } from './client/backend.js';
import { registerOrderTools } from './tools/orders.js';
import { registerCustomerTools } from './tools/customers.js';
import { registerProductTools } from './tools/products.js';
import { registerSalesTools } from './tools/sales.js';

const config = loadConfig();
const client = new BackendClient(config);

// Session management
interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

const sessions = new Map<string, Session>();

// Factory to create a new MCP server with all tools registered
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'ms-fragrance-mcp',
    version: '1.0.0',
  });

  registerOrderTools(server, client);
  registerCustomerTools(server, client);
  registerProductTools(server, client);
  registerSalesTools(server, client);

  return server;
}

// Express app for HTTP transport
const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'ms-fragrance-mcp', version: '1.0.0' });
});

// MCP POST endpoint
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  try {
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session not found' },
          id: null,
        });
        return;
      }
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          console.log(`Session initialized: ${sid}`);
          sessions.set(sid, { transport, server });
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          console.log(`Session closed: ${sid}`);
          sessions.delete(sid);
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
      id: null,
    });
  } catch (error) {
    console.error('MCP POST request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// MCP GET endpoint (SSE streams)
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId) {
    res.status(400).send('Missing session ID');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Session not found' },
      id: null,
    });
    return;
  }

  try {
    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error('MCP GET request error:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing request');
    }
  }
});

// MCP DELETE endpoint (session termination)
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId) {
    res.status(400).send('Missing session ID');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Session not found' },
      id: null,
    });
    return;
  }

  try {
    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error('MCP DELETE request error:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
});

// Start server
const port = config.mcpPort;
app.listen(port, () => {
  console.log(`MS Fragrance MCP Server running on port ${port}`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
  console.log(`Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  for (const [sessionId, session] of sessions) {
    try {
      await session.transport.close();
      sessions.delete(sessionId);
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  process.exit(0);
});

export { sessions, createMcpServer };