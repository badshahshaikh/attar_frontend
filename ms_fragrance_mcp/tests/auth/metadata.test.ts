import { describe, it, expect } from 'vitest';
import { createProtectedResourceMetadata } from '../../src/auth/metadata.js';

describe('createProtectedResourceMetadata', () => {
  const BASE_URL = 'https://msfragrance.in';
  const ISSUER = 'https://test.auth0.com';
  const SCOPES = ['mcp:read', 'mcp:write'];

  it('returns valid OAuth protected-resource metadata', () => {
    const metadata = createProtectedResourceMetadata(BASE_URL, ISSUER, SCOPES);

    expect(metadata.resource).toBe(BASE_URL);
    expect(metadata.authorization_servers).toEqual([ISSUER]);
    expect(metadata.jwks_uri).toBe('https://test.auth0.com/.well-known/jwks.json');
    expect(metadata.scopes_supported).toEqual(SCOPES);
    expect(metadata.bearer_methods_supported).toEqual(['header']);
    expect(metadata.resource_name).toBe('MS Fragrance MCP Server');
  });

  it('includes only mcp:read when that is the only scope', () => {
    const metadata = createProtectedResourceMetadata(BASE_URL, ISSUER, ['mcp:read']);

    expect(metadata.scopes_supported).toEqual(['mcp:read']);
  });

  it('constructs jwks_uri from issuer base URL', () => {
    const metadata = createProtectedResourceMetadata(
      'https://api.example.com',
      'https://custom.auth0.com',
      ['mcp:read']
    );

    expect(metadata.jwks_uri).toBe('https://custom.auth0.com/.well-known/jwks.json');
  });
});
