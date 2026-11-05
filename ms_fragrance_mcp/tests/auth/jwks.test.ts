import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJwksTokenVerifier } from '../../src/auth/jwks.js';

vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return {
    ...actual,
    jwtVerify: vi.fn(),
    createRemoteJWKSet: vi.fn(),
  };
});

import { jwtVerify, createRemoteJWKSet } from 'jose';

const mockJwtVerify = vi.mocked(jwtVerify);
const mockCreateRemoteJWKSet = vi.mocked(createRemoteJWKSet);

const ISSUER = 'https://test.auth0.com';
const AUDIENCE = 'https://msfragrance.in/api/mcp';

function makeMockPayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: ISSUER,
    aud: AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: 'mcp:read mcp:write',
    client_id: 'test-client',
    ...overrides,
  };
}

describe('createJwksTokenVerifier', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateRemoteJWKSet.mockReturnValue({});
  });

  it('verifies a valid token and returns AuthInfo with scopes', async () => {
    const payload = makeMockPayload();
    mockJwtVerify.mockResolvedValue({ payload } as any);

    const verifier = createJwksTokenVerifier(ISSUER, AUDIENCE);
    const result = await verifier.verifyAccessToken('valid-token');

    expect(mockJwtVerify).toHaveBeenCalledWith(
      'valid-token',
      expect.anything(),
      expect.objectContaining({
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['RS256'],
      })
    );
    expect(result.token).toBe('valid-token');
    expect(result.clientId).toBe('test-client');
    expect(result.scopes).toContain('mcp:read');
    expect(result.scopes).toContain('mcp:write');
    expect(result.expiresAt).toBe(payload.exp);
  });

  it('returns empty scopes when token has no scope claim', async () => {
    const payload = makeMockPayload({ scope: undefined });
    mockJwtVerify.mockResolvedValue({ payload } as any);

    const verifier = createJwksTokenVerifier(ISSUER, AUDIENCE);
    const result = await verifier.verifyAccessToken('valid-token');

    expect(result.scopes).toEqual([]);
  });

  it('throws on invalid token', async () => {
    mockJwtVerify.mockRejectedValue(new Error('Invalid token'));

    const verifier = createJwksTokenVerifier(ISSUER, AUDIENCE);
    await expect(verifier.verifyAccessToken('bad-token')).rejects.toThrow(
      'Invalid token'
    );
  });

  it('throws on expired token', async () => {
    mockJwtVerify.mockRejectedValue(new Error('JWT expired'));

    const verifier = createJwksTokenVerifier(ISSUER, AUDIENCE);
    await expect(verifier.verifyAccessToken('expired-token')).rejects.toThrow(
      'JWT expired'
    );
  });

  it('throws on wrong audience', async () => {
    mockJwtVerify.mockRejectedValue(new Error('JWT audience invalid'));

    const verifier = createJwksTokenVerifier(ISSUER, AUDIENCE);
    await expect(verifier.verifyAccessToken('wrong-aud-token')).rejects.toThrow(
      'JWT audience invalid'
    );
  });

  it('throws on wrong issuer', async () => {
    mockJwtVerify.mockRejectedValue(new Error('JWT issuer invalid'));

    const verifier = createJwksTokenVerifier(ISSUER, AUDIENCE);
    await expect(
      verifier.verifyAccessToken('wrong-issuer-token')
    ).rejects.toThrow('JWT issuer invalid');
  });
});
