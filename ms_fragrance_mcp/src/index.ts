import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { metadataHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/metadata.js';
import express, { Request, Response, NextFunction } from 'express';
import { loadConfig } from './config.js';
import { BackendClient } from './client/backend.js';
import { registerOrderTools } from './tools/orders.js';
import { registerCustomerTools } from './tools/customers.js';
import { registerProductTools } from './tools/products.js';
import { registerSalesTools } from './tools/sales.js';
import { createJwksTokenVerifier } from './auth/jwks.js';
import { createProtectedResourceMetadata } from './auth/metadata.js';
import { createBearerAuthMiddleware } from './auth/middleware.js';

const config = loadConfig();
const client = new BackendClient(config);

// Auth0 OAuth 2.1 protected resource setup
const jwksVerifier = createJwksTokenVerifier(
  config.auth0IssuerBaseUrl,
  config.auth0Audience
);
const protectedResourceMetadata = createProtectedResourceMetadata(
  config.auth0IssuerBaseUrl,
  config.auth0IssuerBaseUrl,
  config.mcpResourceScopes
);
const bearerAuthMiddleware = createBearerAuthMiddleware(
  jwksVerifier,
  config.mcpResourceScopes,
  new URL('/.well-known/oauth-protected-resource', config.auth0IssuerBaseUrl).href
);

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Too many requests. Please slow down.' },
      id: null,
    });
    return;
  }

  entry.count++;
  next();
}

function auditLog(toolName: string, status: string, meta: Record<string, unknown>): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    tool: toolName,
    status,
    ip: meta.ip,
    sessionId: meta.sessionId,
  }));
}

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

const app = express();
app.use(express.json());

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'ms-fragrance-mcp', version: '1.0.0' });
});

// Apply rate limiting to MCP endpoints
app.use('/mcp', rateLimiter);

// Apply Auth0 JWT bearer authentication to MCP endpoints
app.use('/mcp', bearerAuthMiddleware);

// OAuth protected-resource metadata (RFC 9728)
app.use(
  '/.well-known/oauth-protected-resource',
  metadataHandler(protectedResourceMetadata)
);

// Stateless MCP handler
async function handleMcpRequest(req: Request, res: Response) {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

// MCP POST endpoint - initialization and subsequent requests
app.post('/mcp', async (req, res) => {
  await handleMcpRequest(req, res);
});

// MCP GET endpoint - SSE streams for event notifications
app.get('/mcp', async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('MCP GET request error:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing request');
    }
  }
});

// MCP DELETE endpoint - session termination
app.delete('/mcp', (req, res) => {
  res.status(200).json({ success: true, message: 'Session terminated' });
});

// Export app for Vercel serverless functions
export default app;
export { app, createMcpServer, handleMcpRequest, rateLimiter, auditLog };
