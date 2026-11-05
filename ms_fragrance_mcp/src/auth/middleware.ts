import { RequestHandler } from 'express';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';

export function createBearerAuthMiddleware(
  verifier: OAuthTokenVerifier,
  requiredScopes: string[],
  resourceMetadataUrl: string
): RequestHandler {
  return requireBearerAuth({
    verifier,
    requiredScopes,
    resourceMetadataUrl,
  });
}
