import { Injectable } from '@nestjs/common';

import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { type WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import {
  AduanaProjectionAuditEntity,
  type AduanaProjectionAuditStatus,
  type AduanaProjectionAuthMetadata,
} from 'src/modules/aduana-projection/aduana-projection-audit.entity';
import {
  canonicalizeAduanaProjectionEnvelope,
  hashCanonicalAduanaProjectionEnvelope,
} from 'src/modules/aduana-projection/services/aduana-projection-canonicalizer.service';

type IngestAduanaProjectionInput = {
  workspaceId: string;
  authMetadata: AduanaProjectionAuthMetadata;
  rawBody: Buffer;
};

type IngestAduanaProjectionResult = {
  eventId: string | null;
  canonicalHash: string | null;
  status: AduanaProjectionAuditStatus;
  quarantineReason: string | null;
};

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const ACCEPTED_EVENT_UNIQUE_INDEX =
  'IDX_ADUANA_PROJECTION_AUDIT_ACCEPTED_WORKSPACE_EVENT';
const DURABLE_NONCE_UNIQUE_INDEX =
  'IDX_ADUANA_PROJECTION_AUDIT_WORKSPACE_NONCE';

type UniqueViolationError = Error & {
  code?: string;
  constraint?: string;
};

const isUniqueViolation = (
  error: unknown,
  indexName: string,
): error is UniqueViolationError => {
  return (
    error instanceof Error &&
    (error as UniqueViolationError).code === POSTGRES_UNIQUE_VIOLATION_CODE &&
    (error as UniqueViolationError).constraint === indexName
  );
};

@Injectable()
export class AduanaProjectionIngestionService {
  constructor(
    @InjectWorkspaceScopedRepository(AduanaProjectionAuditEntity)
    private readonly auditRepository: WorkspaceScopedRepository<AduanaProjectionAuditEntity>,
  ) {}

  async ingest({
    workspaceId,
    authMetadata,
    rawBody,
  }: IngestAduanaProjectionInput): Promise<IngestAduanaProjectionResult> {
    const rawBodyText = rawBody.toString('utf8');
    let parsedEnvelope: unknown;

    try {
      parsedEnvelope = JSON.parse(rawBodyText) as unknown;
    } catch (error) {
      const quarantineReason =
        error instanceof Error ? error.message : 'Invalid Aduana envelope';

      return this.saveInvalidEnvelopeQuarantine({
        workspaceId,
        rawBody: rawBodyText,
        authMetadata,
        quarantineReason,
      });
    }

    try {
      const { envelope, canonicalJson } =
        canonicalizeAduanaProjectionEnvelope(parsedEnvelope);
      const canonicalHash =
        hashCanonicalAduanaProjectionEnvelope(canonicalJson);
      const acceptedAudit = await this.auditRepository.findOne(workspaceId, {
        where: { eventId: envelope.eventId, status: 'accepted' },
      });
      const replayClassification = this.classifyReplay(
        acceptedAudit,
        envelope.eventId,
        canonicalHash,
      );

      await this.saveAuditRecord({
        workspaceId,
        eventId: envelope.eventId,
        rawBody: rawBodyText,
        authMetadata,
        canonicalHash,
        status: replayClassification.status,
        quarantineReason: replayClassification.quarantineReason,
      });

      return {
        eventId: envelope.eventId,
        canonicalHash,
        ...replayClassification,
      };
    } catch (error) {
      if (isUniqueViolation(error, DURABLE_NONCE_UNIQUE_INDEX)) {
        return this.buildDuplicateNonceResult(authMetadata.nonce);
      }

      if (isUniqueViolation(error, ACCEPTED_EVENT_UNIQUE_INDEX)) {
        const { envelope, canonicalJson } =
          canonicalizeAduanaProjectionEnvelope(parsedEnvelope);

        return this.classifyConcurrentAcceptedReplay({
          workspaceId,
          eventId: envelope.eventId,
          canonicalHash: hashCanonicalAduanaProjectionEnvelope(canonicalJson),
          rawBody: rawBodyText,
          authMetadata,
        });
      }

      const quarantineReason =
        error instanceof Error ? error.message : 'Invalid Aduana envelope';

      return this.saveInvalidEnvelopeQuarantine({
        workspaceId,
        rawBody: rawBodyText,
        authMetadata,
        quarantineReason,
      });
    }
  }

  private classifyReplay(
    acceptedAudit: AduanaProjectionAuditEntity | null,
    eventId: string,
    canonicalHash: string,
  ): Pick<IngestAduanaProjectionResult, 'status' | 'quarantineReason'> {
    if (acceptedAudit === null) {
      return { status: 'accepted', quarantineReason: null };
    }

    if (acceptedAudit.canonicalHash === canonicalHash) {
      return { status: 'replayed', quarantineReason: null };
    }

    return {
      status: 'quarantined',
      quarantineReason: `Conflicting Aduana event replay for eventId ${eventId}`,
    };
  }

  private async classifyConcurrentAcceptedReplay({
    workspaceId,
    eventId,
    canonicalHash,
    rawBody,
    authMetadata,
  }: {
    workspaceId: string;
    eventId: string;
    canonicalHash: string;
    rawBody: string;
    authMetadata: AduanaProjectionAuthMetadata;
  }): Promise<IngestAduanaProjectionResult> {
    const acceptedAudit = await this.auditRepository.findOne(workspaceId, {
      where: { eventId, status: 'accepted' },
    });
    const replayClassification = this.classifyReplay(
      acceptedAudit,
      eventId,
      canonicalHash,
    );

    if (replayClassification.status === 'quarantined') {
      try {
        await this.saveAuditRecord({
          workspaceId,
          eventId,
          rawBody,
          authMetadata,
          canonicalHash,
          status: replayClassification.status,
          quarantineReason: replayClassification.quarantineReason,
        });
      } catch (error) {
        if (isUniqueViolation(error, DURABLE_NONCE_UNIQUE_INDEX)) {
          return this.buildDuplicateNonceResult(authMetadata.nonce);
        }

        throw error;
      }
    }

    return {
      eventId,
      canonicalHash,
      ...replayClassification,
    };
  }

  private async saveAuditRecord({
    workspaceId,
    eventId,
    rawBody,
    authMetadata,
    canonicalHash,
    status,
    quarantineReason,
  }: {
    workspaceId: string;
    eventId: string | null;
    rawBody: string;
    authMetadata: AduanaProjectionAuthMetadata;
    canonicalHash: string | null;
    status: AduanaProjectionAuditStatus;
    quarantineReason: string | null;
  }): Promise<void> {
    await this.auditRepository.save(workspaceId, {
      eventId,
      rawBody,
      authMetadata,
      authNonce: authMetadata.nonce,
      canonicalHash,
      status,
      quarantineReason,
    });
  }

  private async saveInvalidEnvelopeQuarantine({
    workspaceId,
    rawBody,
    authMetadata,
    quarantineReason,
  }: {
    workspaceId: string;
    rawBody: string;
    authMetadata: AduanaProjectionAuthMetadata;
    quarantineReason: string;
  }): Promise<IngestAduanaProjectionResult> {
    try {
      await this.saveAuditRecord({
        workspaceId,
        eventId: null,
        rawBody,
        authMetadata,
        canonicalHash: null,
        status: 'quarantined',
        quarantineReason,
      });
    } catch (error) {
      if (isUniqueViolation(error, DURABLE_NONCE_UNIQUE_INDEX)) {
        return this.buildDuplicateNonceResult(authMetadata.nonce);
      }

      throw error;
    }

    return {
      eventId: null,
      canonicalHash: null,
      status: 'quarantined',
      quarantineReason,
    };
  }

  private buildDuplicateNonceResult(
    nonce: string,
  ): IngestAduanaProjectionResult {
    return {
      eventId: null,
      canonicalHash: null,
      status: 'quarantined',
      quarantineReason: `Replayed Aduana nonce ${nonce}`,
    };
  }
}
