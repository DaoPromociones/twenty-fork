import { createHmac, timingSafeEqual } from 'crypto';

export type AduanaProjectionSignaturePayloadInput = {
  method: string;
  path: string;
  workspaceId: string;
  timestamp: string;
  nonce: string;
  rawBody: Buffer;
};

export const buildAduanaProjectionSignaturePayload = ({
  method,
  path,
  workspaceId,
  timestamp,
  nonce,
  rawBody,
}: AduanaProjectionSignaturePayloadInput): Buffer =>
  Buffer.concat([
    Buffer.from(
      [method.toUpperCase(), path, workspaceId, timestamp, nonce, ''].join(
        '\n',
      ),
      'utf8',
    ),
    rawBody,
  ]);

export const verifyAduanaProjectionSignature = (
  payload: Buffer,
  signature: string,
  secret: string,
): boolean => {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  const normalizedSignature = signature.replace(/^sha256=/, '');

  if (expectedSignature.length !== normalizedSignature.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expectedSignature, 'utf8'),
    Buffer.from(normalizedSignature, 'utf8'),
  );
};
