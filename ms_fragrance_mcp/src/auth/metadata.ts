import { OAuthProtectedResourceMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

export function createProtectedResourceMetadata(
  resourceUrl: string,
  authorizationServer: string,
  scopes: string[]
): OAuthProtectedResourceMetadata {
  return {
    resource: resourceUrl,
    authorization_servers: [authorizationServer],
    jwks_uri: new URL('/.well-known/jwks.json', authorizationServer).href,
    scopes_supported: scopes,
    bearer_methods_supported: ['header'],
    resource_name: 'MS Fragrance MCP Server',
  };
}
