import { createHmac } from 'crypto';

import {
  buildAduanaProjectionSignaturePayload,
  verifyAduanaProjectionSignature,
} from 'src/modules/aduana-projection/services/aduana-projection-signature.service';

describe('AduanaProjectionSignatureService', () => {
  const secret = 'test-secret-never-real';

  const sign = (payload: Buffer) =>
    createHmac('sha256', secret).update(payload).digest('hex');

  it('should cover method, path, workspaceId, timestamp, nonce, and raw body bytes', () => {
    const rawBody = Buffer.from('{"eventId":"evt-1","summary":"ok"}', 'utf8');
    const payload = buildAduanaProjectionSignaturePayload({
      method: 'POST',
      path: '/webhooks/aduana/projection/workspace-1',
      workspaceId: 'workspace-1',
      timestamp: '2026-07-05T20:00:00.000Z',
      nonce: 'nonce-1',
      rawBody,
    });

    expect(
      verifyAduanaProjectionSignature(payload, sign(payload), secret),
    ).toBe(true);
  });

  it.each([
    ['method', { method: 'GET' }],
    ['path', { path: '/webhooks/aduana/projection/workspace-2' }],
    ['workspaceId', { workspaceId: 'workspace-2' }],
    ['timestamp', { timestamp: '2026-07-05T20:05:00.000Z' }],
    ['nonce', { nonce: 'nonce-2' }],
    [
      'rawBody',
      { rawBody: Buffer.from('{"eventId":"evt-1","summary":"tampered"}') },
    ],
  ])('should reject signatures when %s changes', (_field, override) => {
    const request = {
      method: 'POST',
      path: '/webhooks/aduana/projection/workspace-1',
      workspaceId: 'workspace-1',
      timestamp: '2026-07-05T20:00:00.000Z',
      nonce: 'nonce-1',
      rawBody: Buffer.from('{"eventId":"evt-1","summary":"ok"}', 'utf8'),
    };
    const validPayload = buildAduanaProjectionSignaturePayload(request);
    const tamperedPayload = buildAduanaProjectionSignaturePayload({
      ...request,
      ...override,
    });

    expect(
      verifyAduanaProjectionSignature(
        tamperedPayload,
        sign(validPayload),
        secret,
      ),
    ).toBe(false);
  });
});
