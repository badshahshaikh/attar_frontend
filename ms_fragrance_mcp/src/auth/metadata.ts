import { OAuthProtectedResourceMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

export function createProtectedResourceMetadata(
  baseUrl: string,
  issuerBaseUrl: string,
  scopes: string[]
): OAuthProtectedResourceMetadata {
  return {
    resource: baseUrl,
    authorization_servers: [issuerBaseUrl],
    jwks_uri: new URL('/.well-known/jwks.json', issuerBaseUrl).href,
    scopes_supported: scopes,
    bearer_methods_supported: ['header'],
    resource_name: 'MS Fragrance MCP Server',
  };
}
