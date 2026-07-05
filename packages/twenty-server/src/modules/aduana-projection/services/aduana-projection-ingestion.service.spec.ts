import { AduanaProjectionIngestionService } from 'src/modules/aduana-projection/services/aduana-projection-ingestion.service';

describe('AduanaProjectionIngestionService', () => {
  const buildUniqueViolation = (constraint: string) =>
    Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint,
    });

  const buildRepository = (acceptedRecord?: { canonicalHash: string }) => ({
    findOne: jest.fn(async () => acceptedRecord ?? null),
    save: jest.fn(async (_workspaceId, record) => record),
  });

  const envelope = {
    eventId: 'evt-1',
    eventType: 'customs.released',
    occurredAt: '2026-07-05T19:30:00.000Z',
    sourceRecordId: 'record-1',
    evidenceId: 'evidence-1',
    summary: 'descriptive only',
  };

  it('should accept the first valid event and retain raw body audit data', async () => {
    const repository = buildRepository();
    const service = new AduanaProjectionIngestionService(repository as never);
    const rawBody = Buffer.from(JSON.stringify(envelope));

    await expect(
      service.ingest({
        workspaceId: 'workspace-1',
        authMetadata: {
          timestamp: '2026-07-05T20:00:00.000Z',
          nonce: 'nonce-1',
        },
        rawBody,
      }),
    ).resolves.toMatchObject({ status: 'accepted', eventId: 'evt-1' });
    expect(repository.save).toHaveBeenCalledWith(
      'workspace-1',
      expect.objectContaining({
        eventId: 'evt-1',
        rawBody: rawBody.toString('utf8'),
        status: 'accepted',
      }),
    );
  });

  it('should classify an identical eventId and canonical hash as idempotent', async () => {
    const firstRepository = buildRepository();
    const firstService = new AduanaProjectionIngestionService(
      firstRepository as never,
    );
    const firstResult = await firstService.ingest({
      workspaceId: 'workspace-1',
      authMetadata: { timestamp: '2026-07-05T20:00:00.000Z', nonce: 'nonce-1' },
      rawBody: Buffer.from(JSON.stringify(envelope)),
    });

    expect(firstResult.canonicalHash).not.toBeNull();

    const replayRepository = buildRepository({
      canonicalHash: firstResult.canonicalHash ?? '',
    });
    const replayService = new AduanaProjectionIngestionService(
      replayRepository as never,
    );

    await expect(
      replayService.ingest({
        workspaceId: 'workspace-1',
        authMetadata: {
          timestamp: '2026-07-05T20:01:00.000Z',
          nonce: 'nonce-2',
        },
        rawBody: Buffer.from(JSON.stringify(envelope)),
      }),
    ).resolves.toMatchObject({ status: 'replayed', eventId: 'evt-1' });
  });

  it('should quarantine the same eventId with a different canonical hash', async () => {
    const repository = buildRepository({ canonicalHash: 'different-hash' });
    const service = new AduanaProjectionIngestionService(repository as never);

    await expect(
      service.ingest({
        workspaceId: 'workspace-1',
        authMetadata: {
          timestamp: '2026-07-05T20:00:00.000Z',
          nonce: 'nonce-1',
        },
        rawBody: Buffer.from(JSON.stringify(envelope)),
      }),
    ).resolves.toMatchObject({
      status: 'quarantined',
      quarantineReason: 'Conflicting Aduana event replay for eventId evt-1',
    });
    expect(repository.save).toHaveBeenCalledWith(
      'workspace-1',
      expect.objectContaining({ status: 'quarantined' }),
    );
  });

  it('should quarantine an invalid envelope without updating an accepted projection row', async () => {
    const repository = buildRepository({ canonicalHash: 'accepted-hash' });
    const service = new AduanaProjectionIngestionService(repository as never);
    const invalidEnvelope = Buffer.from(
      JSON.stringify({
        eventId: 'evt-1',
        eventType: 'customs.released',
        sourceRecordId: 'record-1',
      }),
    );

    await expect(
      service.ingest({
        workspaceId: 'workspace-1',
        authMetadata: {
          timestamp: '2026-07-05T20:00:00.000Z',
          nonce: 'nonce-1',
        },
        rawBody: invalidEnvelope,
      }),
    ).resolves.toMatchObject({
      eventId: null,
      canonicalHash: null,
      status: 'quarantined',
      quarantineReason: 'Missing required Aduana trusted field: occurredAt',
    });
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(
      'workspace-1',
      expect.objectContaining({
        eventId: null,
        rawBody: invalidEnvelope.toString('utf8'),
        canonicalHash: null,
        status: 'quarantined',
        quarantineReason: 'Missing required Aduana trusted field: occurredAt',
      }),
    );
  });

  it('should expose only audit repository persistence for accepted ingestion', async () => {
    const repository = buildRepository();
    const service = new AduanaProjectionIngestionService(repository as never);

    await expect(
      service.ingest({
        workspaceId: 'workspace-1',
        authMetadata: {
          timestamp: '2026-07-05T20:00:00.000Z',
          nonce: 'nonce-1',
        },
        rawBody: Buffer.from(JSON.stringify(envelope)),
      }),
    ).resolves.toMatchObject({ status: 'accepted', eventId: 'evt-1' });
    expect(AduanaProjectionIngestionService.length).toBe(1);
    expect(repository.findOne).toHaveBeenCalledWith('workspace-1', {
      where: { eventId: 'evt-1', status: 'accepted' },
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(
      'workspace-1',
      expect.objectContaining({
        authNonce: 'nonce-1',
        eventId: 'evt-1',
        status: 'accepted',
      }),
    );
  });

  it('should classify a concurrent duplicate accepted event with the same canonical hash as replayed', async () => {
    const firstService = new AduanaProjectionIngestionService(
      buildRepository() as never,
    );
    const firstResult = await firstService.ingest({
      workspaceId: 'workspace-1',
      authMetadata: { timestamp: '2026-07-05T20:00:00.000Z', nonce: 'nonce-1' },
      rawBody: Buffer.from(JSON.stringify(envelope)),
    });

    expect(firstResult.canonicalHash).not.toBeNull();

    const repository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          canonicalHash: firstResult.canonicalHash ?? '',
        }),
      save: jest.fn(async () => {
        throw buildUniqueViolation(
          'IDX_ADUANA_PROJECTION_AUDIT_ACCEPTED_WORKSPACE_EVENT',
        );
      }),
    };
    const service = new AduanaProjectionIngestionService(repository as never);

    await expect(
      service.ingest({
        workspaceId: 'workspace-1',
        authMetadata: {
          timestamp: '2026-07-05T20:01:00.000Z',
          nonce: 'nonce-2',
        },
        rawBody: Buffer.from(JSON.stringify(envelope)),
      }),
    ).resolves.toMatchObject({ status: 'replayed', eventId: 'evt-1' });
    expect(repository.findOne).toHaveBeenCalledTimes(2);
  });

  it('should quarantine a concurrent duplicate accepted event with a different canonical hash', async () => {
    const repository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ canonicalHash: 'different-hash' }),
      save: jest
        .fn()
        .mockRejectedValueOnce(
          buildUniqueViolation(
            'IDX_ADUANA_PROJECTION_AUDIT_ACCEPTED_WORKSPACE_EVENT',
          ),
        )
        .mockImplementationOnce(async (_workspaceId, record) => record),
    };
    const service = new AduanaProjectionIngestionService(repository as never);

    await expect(
      service.ingest({
        workspaceId: 'workspace-1',
        authMetadata: {
          timestamp: '2026-07-05T20:01:00.000Z',
          nonce: 'nonce-2',
        },
        rawBody: Buffer.from(JSON.stringify(envelope)),
      }),
    ).resolves.toMatchObject({
      status: 'quarantined',
      quarantineReason: 'Conflicting Aduana event replay for eventId evt-1',
    });
    expect(repository.save).toHaveBeenLastCalledWith(
      'workspace-1',
      expect.objectContaining({ status: 'quarantined' }),
    );
  });

  it('should quarantine a persisted duplicate nonce conflict deterministically', async () => {
    const repository = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async () => {
        throw buildUniqueViolation(
          'IDX_ADUANA_PROJECTION_AUDIT_WORKSPACE_NONCE',
        );
      }),
    };
    const service = new AduanaProjectionIngestionService(repository as never);

    await expect(
      service.ingest({
        workspaceId: 'workspace-1',
        authMetadata: {
          timestamp: '2026-07-05T20:01:00.000Z',
          nonce: 'nonce-1',
        },
        rawBody: Buffer.from(JSON.stringify(envelope)),
      }),
    ).resolves.toMatchObject({
      status: 'quarantined',
      quarantineReason: 'Replayed Aduana nonce nonce-1',
    });
  });
});
