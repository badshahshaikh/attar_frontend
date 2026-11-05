import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  backendApiUrl: string;
  backendServiceKey: string;
  mcpAccessKey: string;
  mcpPort: number;
  nodeEnv: string;
  auth0IssuerBaseUrl: string;
  auth0Audience: string;
  mcpResourceScopes: string[];
}

export function loadConfig(): Config {
  const backendApiUrl = process.env.BACKEND_API_URL;
  const backendServiceKey = process.env.BACKEND_SERVICE_KEY;
  const mcpAccessKey = process.env.MCP_ACCESS_KEY;
  const mcpPort = parseInt(process.env.MCP_PORT || '3001', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const auth0IssuerBaseUrlRaw = process.env.AUTH0_ISSUER_BASE_URL;
  const auth0AudienceRaw = process.env.AUTH0_AUDIENCE;
  const mcpResourceScopes = (
    process.env.MCP_RESOURCE_SCOPES || 'mcp:read'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!backendApiUrl) {
    throw new Error('BACKEND_API_URL environment variable is required');
  }

  if (!backendServiceKey) {
    throw new Error('BACKEND_SERVICE_KEY environment variable is required');
  }

  if (!auth0IssuerBaseUrlRaw) {
    throw new Error('AUTH0_ISSUER_BASE_URL environment variable is required');
  }

  if (!auth0AudienceRaw) {
    throw new Error('AUTH0_AUDIENCE environment variable is required');
  }

  if (!mcpAccessKey) {
    throw new Error('MCP_ACCESS_KEY environment variable is required');
  }

  const auth0IssuerBaseUrl = auth0IssuerBaseUrlRaw.replace(/\/$/, '');
  const auth0Audience = auth0AudienceRaw;

  return {
    backendApiUrl: backendApiUrl.replace(/\/$/, ''),
    backendServiceKey,
    mcpAccessKey,
    mcpPort,
    nodeEnv,
    auth0IssuerBaseUrl,
    auth0Audience,
    mcpResourceScopes,
  };
}