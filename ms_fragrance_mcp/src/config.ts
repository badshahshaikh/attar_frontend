import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  backendApiUrl: string;
  backendServiceKey: string;
  mcpAccessKey: string;
  mcpPort: number;
  nodeEnv: string;
}

export function loadConfig(): Config {
  const backendApiUrl = process.env.BACKEND_API_URL;
  const backendServiceKey = process.env.BACKEND_SERVICE_KEY;
  const mcpAccessKey = process.env.MCP_ACCESS_KEY;
  const mcpPort = parseInt(process.env.MCP_PORT || '3001', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!backendApiUrl) {
    throw new Error('BACKEND_API_URL environment variable is required');
  }

  if (!backendServiceKey) {
    throw new Error('BACKEND_SERVICE_KEY environment variable is required');
  }

  if (!mcpAccessKey) {
    throw new Error('MCP_ACCESS_KEY environment variable is required');
  }

  return {
    backendApiUrl: backendApiUrl.replace(/\/$/, ''),
    backendServiceKey,
    mcpAccessKey,
    mcpPort,
    nodeEnv,
  };
}