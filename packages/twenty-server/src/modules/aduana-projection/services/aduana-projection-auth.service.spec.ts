import { createHmac } from 'crypto';

import { AduanaProjectionAuthService } from 'src/modules/aduana-projection/services/aduana-projection-auth.service';
import { buildAduanaProjectionSignaturePayload } from 'src/modules/aduana-projection/services/aduana-projection-signature.service';

describe('AduanaProjectionAuthService', () => {
  const fixedNow = new Date('2026-07-05T20:00:00.000Z');
  const rawBody = Buffer.from('{"eventId":"evt-1"}', 'utf8');
  const secret = 'test-secret-never-real';

  const buildAuth = () =>
    new AduanaProjectionAuthService(
      {
        getSecretForWorkspace: jest.fn((workspaceId: string) =>
          workspaceId === 'workspace-1' ? secret : undefined,
        ),
      },
      () => fixedNow,
    );

  const buildHeaders = (overrides: Record<string, string> = {}) => {
    const baseHeaders = {
      'x-aduana-workspace-id': 'workspace-1',
      'x-aduana-timestamp': '2026-07-05T19:59:00.000Z',
      'x-aduana-nonce': 'nonce-1',
    };
    const headers = { ...baseHeaders, ...overrides };
    const payload = buildAduanaProjectionSignaturePayload({
      method: 'POST',
      path: '/webhooks/aduana/projection/workspace-1',
      workspaceId: headers['x-aduana-workspace-id'],
      timestamp: headers['x-aduana-timestamp'],
      nonce: headers['x-aduana-nonce'],
      rawBody,
    });

    return {
      ...headers,
      'x-aduana-signature': createHmac('sha256', secret)
        .update(payload)
        .digest('hex'),
    };
  };

  it('should accept a fresh workspace-bound signature once', () => {
    const auth = buildAuth();

    expect(
      auth.verifyRequest({
        method: 'POST',
        path: '/webhooks/aduana/projection/workspace-1',
        pathWorkspaceId: 'workspace-1',
        headers: buildHeaders(),
        rawBody,
      }),
    ).toEqual({
      workspaceId: 'workspace-1',
      timestamp: '2026-07-05T19:59:00.000Z',
      nonce: 'nonce-1',
    });
  });

  it.each([
    [
      'workspace mismatch',
      { 'x-aduana-workspace-id': 'workspace-2' },
      'workspace mismatch',
    ],
    [
      'stale timestamp',
      { 'x-aduana-timestamp': '2026-07-05T19:40:00.000Z' },
      'stale timestamp',
    ],
    ['bad signature', {}, 'bad signature'],
  ])('should reject %s', (_name, headerOverrides, expectedMessage) => {
    const auth = buildAuth();
    const headers = buildHeaders(headerOverrides);

    if (expectedMessage === 'bad signature') {
      headers['x-aduana-signature'] = 'bad-signature';
    }

    expect(() =>
      auth.verifyRequest({
        method: 'POST',
        path: '/webhooks/aduana/projection/workspace-1',
        pathWorkspaceId: 'workspace-1',
        headers,
        rawBody,
      }),
    ).toThrow(expectedMessage);
  });

  it('should reject a replayed nonce', () => {
    const auth = buildAuth();
    const request = {
      method: 'POST',
      path: '/webhooks/aduana/projection/workspace-1',
      pathWorkspaceId: 'workspace-1',
      headers: buildHeaders(),
      rawBody,
    };

    auth.verifyRequest(request);

    expect(() => auth.verifyRequest(request)).toThrow('replayed nonce');
  });
});
