import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { type AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export function createJwksTokenVerifier(
  issuerBaseUrl: string,
  audience: string
): OAuthTokenVerifier {
  const jwksUrl = new URL('/.well-known/jwks.json', issuerBaseUrl).href;
  const getJwkSet = createRemoteJWKSet(new URL(jwksUrl), {
    cacheMaxAge: 5 * 60 * 1000, // 5 minutes
  });

  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const { payload } = await jwtVerify(token, getJwkSet, {
        issuer: issuerBaseUrl,
        audience,
        algorithms: ['RS256'],
      });

      const scopes: string[] = (payload.scope as string | undefined)
        ?.split(/\s+/)
        .filter(Boolean) ?? [];

      return {
        token,
        clientId: (payload.client_id as string | undefined) ?? '',
        scopes,
        expiresAt: (payload.exp as number | undefined) ?? 0,
        resource: payload.aud
          ? new URL(typeof payload.aud === 'string' ? payload.aud : String(payload.aud[0]))
          : undefined,
      };
    },
  };
}
