import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock(
  '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js',
  async (importOriginal) => {
    const actual = await importOriginal<typeof import('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js')>();
    return {
      ...actual,
      requireBearerAuth: vi.fn(),
    };
  }
);

import { createBearerAuthMiddleware } from '../../src/auth/middleware.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';

const mockRequireBearerAuth = vi.mocked(requireBearerAuth);

const mockVerifier = {
  verifyAccessToken: vi.fn(),
};

describe('createBearerAuthMiddleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireBearerAuth.mockReturnValue((_req: any, _res: any, next: any) => {
      next();
    });
  });

  it('passes verifier, scopes, and resource metadata URL to requireBearerAuth', () => {
    const resourceMetadataUrl =
      'https://test.auth0.com/.well-known/oauth-protected-resource';

    createBearerAuthMiddleware(mockVerifier as any, ['mcp:read'], resourceMetadataUrl);

    expect(mockRequireBearerAuth).toHaveBeenCalledWith({
      verifier: mockVerifier,
      requiredScopes: ['mcp:read'],
      resourceMetadataUrl,
    });
  });

  it('returns a RequestHandler function', () => {
    const result = createBearerAuthMiddleware(
      mockVerifier as any,
      ['mcp:read'],
      'https://example.com/metadata'
    );

    expect(typeof result).toBe('function');
    expect(result.length).toBe(3); // (req, res, next)
  });
});
