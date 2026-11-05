import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('loadConfig', () => {
  it('loads Auth0 configuration from environment variables', async () => {
    process.env.BACKEND_API_URL = 'http://localhost:5000';
    process.env.BACKEND_SERVICE_KEY = 'test-service-key';
    process.env.MCP_ACCESS_KEY = 'test-mcp-key';
    process.env.AUTH0_ISSUER_BASE_URL = 'https://test.auth0.com';
    process.env.AUTH0_AUDIENCE = 'https://msfragrance.in/api/mcp';
    process.env.MCP_RESOURCE_SCOPES = 'mcp:read,mcp:write';

    const { loadConfig } = await import('../../src/config.js');
    const config = loadConfig();

    expect(config.auth0IssuerBaseUrl).toBe('https://test.auth0.com');
    expect(config.auth0Audience).toBe('https://msfragrance.in/api/mcp');
    expect(config.mcpResourceScopes).toEqual(['mcp:read', 'mcp:write']);
  });

  it('defaults MCP_RESOURCE_SCOPES to mcp:read', async () => {
    process.env.BACKEND_API_URL = 'http://localhost:5000';
    process.env.BACKEND_SERVICE_KEY = 'test-service-key';
    process.env.MCP_ACCESS_KEY = 'test-mcp-key';
    process.env.AUTH0_ISSUER_BASE_URL = 'https://test.auth0.com';
    process.env.AUTH0_AUDIENCE = 'https://msfragrance.in/api/mcp';
    delete process.env.MCP_RESOURCE_SCOPES;

    const { loadConfig } = await import('../../src/config.js');
    const config = loadConfig();

    expect(config.mcpResourceScopes).toEqual(['mcp:read']);
  });

  it('throws when AUTH0_ISSUER_BASE_URL is missing', async () => {
    process.env.BACKEND_API_URL = 'http://localhost:5000';
    process.env.BACKEND_SERVICE_KEY = 'test-service-key';
    process.env.MCP_ACCESS_KEY = 'test-mcp-key';
    process.env.AUTH0_AUDIENCE = 'https://msfragrance.in/api/mcp';
    delete process.env.AUTH0_ISSUER_BASE_URL;

    const { loadConfig } = await import('../../src/config.js');
    expect(() => loadConfig()).toThrow('AUTH0_ISSUER_BASE_URL');
  });

  it('throws when AUTH0_AUDIENCE is missing', async () => {
    process.env.BACKEND_API_URL = 'http://localhost:5000';
    process.env.BACKEND_SERVICE_KEY = 'test-service-key';
    process.env.MCP_ACCESS_KEY = 'test-mcp-key';
    process.env.AUTH0_ISSUER_BASE_URL = 'https://test.auth0.com';
    delete process.env.AUTH0_AUDIENCE;

    const { loadConfig } = await import('../../src/config.js');
    expect(() => loadConfig()).toThrow('AUTH0_AUDIENCE');
  });
});
