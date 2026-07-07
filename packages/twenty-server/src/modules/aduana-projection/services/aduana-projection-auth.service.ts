import { Injectable, Optional } from '@nestjs/common';

import { AduanaProjectionSecretResolverService } from 'src/modules/aduana-projection/services/aduana-projection-secret-resolver.service';
import {
  buildAduanaProjectionSignaturePayload,
  verifyAduanaProjectionSignature,
} from 'src/modules/aduana-projection/services/aduana-projection-signature.service';

type AduanaProjectionAuthHeaders = Record<
  string,
  string | string[] | undefined
>;

export type AduanaProjectionAuthenticatedRequest = {
  workspaceId: string;
  timestamp: string;
  nonce: string;
};

type VerifyAduanaProjectionRequestInput = {
  method: string;
  path: string;
  pathWorkspaceId: string;
  headers: AduanaProjectionAuthHeaders;
  rawBody: Buffer;
};

const MAX_TIMESTAMP_SKEW_IN_MS = 5 * 60 * 1000;

const getHeader = (
  headers: AduanaProjectionAuthHeaders,
  name: string,
): string => {
  const value = headers[name] ?? headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
};

@Injectable()
export class AduanaProjectionAuthService {
  // Fast in-process replay rejection reduces duplicate work for one server.
  // Durable cross-process replay enforcement happens when ingestion persists authNonce.
  private readonly inProcessAcceptedNonceKeys = new Set<string>();

  constructor(
    private readonly secretResolver: AduanaProjectionSecretResolverService,
    @Optional()
    private readonly getNow: () => Date = () => new Date(),
  ) {}

  verifyRequest({
    method,
    path,
    pathWorkspaceId,
    headers,
    rawBody,
  }: VerifyAduanaProjectionRequestInput): AduanaProjectionAuthenticatedRequest {
    const headerWorkspaceId = getHeader(headers, 'x-aduana-workspace-id');
    const timestamp = getHeader(headers, 'x-aduana-timestamp');
    const nonce = getHeader(headers, 'x-aduana-nonce');
    const signature = getHeader(headers, 'x-aduana-signature');

    if (pathWorkspaceId !== headerWorkspaceId) {
      throw new Error('workspace mismatch');
    }

    const secret = this.secretResolver.getSecretForWorkspace(pathWorkspaceId);

    if (secret === undefined) {
      throw new Error('workspace mismatch');
    }

    const requestTimestamp = new Date(timestamp);

    if (
      Number.isNaN(requestTimestamp.getTime()) ||
      Math.abs(this.getNow().getTime() - requestTimestamp.getTime()) >
        MAX_TIMESTAMP_SKEW_IN_MS
    ) {
      throw new Error('stale timestamp');
    }

    const nonceKey = `${pathWorkspaceId}:${nonce}`;

    if (this.inProcessAcceptedNonceKeys.has(nonceKey)) {
      throw new Error('replayed nonce');
    }

    const payload = buildAduanaProjectionSignaturePayload({
      method,
      path,
      workspaceId: pathWorkspaceId,
      timestamp,
      nonce,
      rawBody,
    });

    if (!verifyAduanaProjectionSignature(payload, signature, secret)) {
      throw new Error('bad signature');
    }

    this.inProcessAcceptedNonceKeys.add(nonceKey);

    return { workspaceId: pathWorkspaceId, timestamp, nonce };
  }
}
