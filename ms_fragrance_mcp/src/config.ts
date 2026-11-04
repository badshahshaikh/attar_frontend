import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  backendApiUrl: string;
  backendAdminToken: string;
  mcpPort: number;
  nodeEnv: string;
}

export function loadConfig(): Config {
  const backendApiUrl = process.env.BACKEND_API_URL;
  const backendAdminToken = process.env.BACKEND_ADMIN_TOKEN;
  const mcpPort = parseInt(process.env.MCP_PORT || '3001', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!backendApiUrl) {
    throw new Error('BACKEND_API_URL environment variable is required');
  }

  if (!backendAdminToken) {
    throw new Error('BACKEND_ADMIN_TOKEN environment variable is required');
  }

  return {
    backendApiUrl: backendApiUrl.replace(/\/$/, ''),
    backendAdminToken,
    mcpPort,
    nodeEnv,
  };
}