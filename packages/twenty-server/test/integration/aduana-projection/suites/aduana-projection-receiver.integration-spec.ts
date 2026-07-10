import { createHmac, randomUUID } from 'node:crypto';

import request from 'supertest';

import { AddAduanaProjectionAuditStorageFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-19/2-19-instance-command-fast-1783517693762-add-aduana-projection-audit-storage';
import { buildAduanaProjectionSignaturePayload } from 'src/modules/aduana-projection/services/aduana-projection-signature.service';

const TEST_WORKSPACE_ID = '20202020-1c25-4d02-bf25-6aeccf7ea419';
const TEST_SCHEMA_NAME = 'workspace_1wgvd1injqtife6y4rvfbu3h5';
const TEST_SECRET = 'fake-aduana-projection-secret';
const RECEIVER_PATH = `/webhooks/aduana/projection/${TEST_WORKSPACE_ID}`;
const UNKNOWN_WORKSPACE_ID = '30303030-1c25-4d02-bf25-6aeccf7ea419';
const UNKNOWN_WORKSPACE_PATH = `/webhooks/aduana/projection/${UNKNOWN_WORKSPACE_ID}`;

type AduanaProjectionAuditRow = {
  eventId: string | null;
  rawBody: string;
  canonicalHash: string | null;
  status: string;
  quarantineReason: string | null;
  authNonce: string;
};

const buildEnvelope = (overrides: Record<string, unknown> = {}) => ({
  eventId: `aduana-receiver-${randomUUID()}`,
  eventType: 'evidence.received',
  occurredAt: '2026-07-06T10:00:00.000Z',
  sourceRecordId: 'source-record-1',
  evidenceId: 'evidence-1',
  summary: 'Consultative projection summary from Aduana',
  ...overrides,
});

const signPayload = ({
  rawBody,
  nonce,
  path = RECEIVER_PATH,
  workspaceId = TEST_WORKSPACE_ID,
  timestamp = new Date().toISOString(),
}: {
  rawBody: Buffer;
  nonce: string;
  path?: string;
  workspaceId?: string;
  timestamp?: string;
}) => {
  const payload = buildAduanaProjectionSignaturePayload({
    method: 'POST',
    path,
    workspaceId,
    timestamp,
    nonce,
    rawBody,
  });

  return {
    timestamp,
    signature: createHmac('sha256', TEST_SECRET).update(payload).digest('hex'),
  };
};

const postRawBody = async ({
  path = RECEIVER_PATH,
  rawBody,
  workspaceId = TEST_WORKSPACE_ID,
  nonce = randomUUID(),
  signature,
}: {
  path?: string;
  rawBody: Buffer;
  workspaceId?: string;
  nonce?: string;
  signature?: string;
}) => {
  const signedPayload = signPayload({ rawBody, nonce, path, workspaceId });

  return request(`http://localhost:${APP_PORT}`)
    .post(path)
    .set('Content-Type', 'application/json')
    .set('X-Aduana-Workspace-Id', workspaceId)
    .set('X-Aduana-Timestamp', signedPayload.timestamp)
    .set('X-Aduana-Nonce', nonce)
    .set('X-Aduana-Signature', `sha256=${signature ?? signedPayload.signature}`)
    .send(rawBody.toString('utf8'));
};

const postSignedEnvelope = async ({
  envelope,
  nonce = randomUUID(),
}: {
  envelope: Record<string, unknown>;
  nonce?: string;
}) => {
  const rawBody = Buffer.from(JSON.stringify(envelope));
  const { signature, timestamp } = signPayload({ rawBody, nonce });

  return request(`http://localhost:${APP_PORT}`)
    .post(RECEIVER_PATH)
    .set('Content-Type', 'application/json')
    .set('X-Aduana-Workspace-Id', TEST_WORKSPACE_ID)
    .set('X-Aduana-Timestamp', timestamp)
    .set('X-Aduana-Nonce', nonce)
    .set('X-Aduana-Signature', `sha256=${signature}`)
    .send(rawBody.toString('utf8'));
};

const selectAuditRows = async (eventId: string) => {
  const rows = await global.testDataSource.query(
    `SELECT "eventId", "rawBody", "canonicalHash", status, "quarantineReason", "authNonce"
     FROM core."aduanaProjectionAudit"
     WHERE "workspaceId" = $1 AND "eventId" = $2
     ORDER BY "receivedAt" ASC`,
    [TEST_WORKSPACE_ID, eventId],
  );

  return rows as AduanaProjectionAuditRow[];
};

const selectAuditRowByNonce = async (authNonce: string) => {
  const [row] = await global.testDataSource.query(
    `SELECT "eventId", "rawBody", "canonicalHash", status, "quarantineReason", "authNonce"
     FROM core."aduanaProjectionAudit"
     WHERE "workspaceId" = $1 AND "authNonce" = $2`,
    [TEST_WORKSPACE_ID, authNonce],
  );

  return row as AduanaProjectionAuditRow | undefined;
};

const selectAuditRowsByNonce = async (authNonce: string) => {
  const rows = await global.testDataSource.query(
    `SELECT "eventId", "rawBody", "canonicalHash", status, "quarantineReason", "authNonce"
     FROM core."aduanaProjectionAudit"
     WHERE "authNonce" = $1`,
    [authNonce],
  );

  return rows as AduanaProjectionAuditRow[];
};

const deleteAuditRows = async (eventIds: string[]) => {
  if (eventIds.length === 0) {
    return;
  }

  await global.testDataSource.query(
    `DELETE FROM core."aduanaProjectionAudit"
     WHERE "workspaceId" = $1 AND "eventId" = ANY($2)`,
    [TEST_WORKSPACE_ID, eventIds],
  );
};

const deleteAuditRowsByNonces = async (authNonces: string[]) => {
  if (authNonces.length === 0) {
    return;
  }

  await global.testDataSource.query(
    `DELETE FROM core."aduanaProjectionAudit"
     WHERE "workspaceId" = $1 AND "authNonce" = ANY($2)`,
    [TEST_WORKSPACE_ID, authNonces],
  );
};

const countProjectionRows = async () => {
  const [result] = await global.testDataSource.query(
    `SELECT COUNT(*)::int AS count FROM "${TEST_SCHEMA_NAME}"."aduanaProjection"`,
  );

  return result.count as number;
};

const ensureCoreSchemaExists = async () => {
  await global.testDataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await global.testDataSource.query('CREATE SCHEMA IF NOT EXISTS "core"');
};

const ensureAduanaProjectionTableExists = async () => {
  await global.testDataSource.query(
    `CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA_NAME}"`,
  );

  await global.testDataSource.query(
    `CREATE TABLE IF NOT EXISTS "${TEST_SCHEMA_NAME}"."aduanaProjection" (
       id uuid PRIMARY KEY,
       "eventId" text NOT NULL,
       "eventType" text NOT NULL,
       "occurredAt" timestamptz NOT NULL,
       "sourceRecordId" text NOT NULL,
       "evidenceId" text NOT NULL,
       summary text,
       "ingestionStatus" text NOT NULL,
       "receivedAt" timestamptz NOT NULL,
       "deletedAt" timestamptz
     )`,
  );
};

const deleteProjectionRows = async () => {
  await global.testDataSource.query(
    `DELETE FROM "${TEST_SCHEMA_NAME}"."aduanaProjection"`,
  );
};

describe('Aduana projection receiver integration', () => {
  const eventIdsToDelete: string[] = [];
  const noncesToDelete: string[] = [];

  beforeAll(async () => {
    process.env.ADUANA_PROJECTION_WORKSPACE_SECRETS = JSON.stringify({
      [TEST_WORKSPACE_ID]: TEST_SECRET,
    });

    const queryRunner = global.testDataSource.createQueryRunner();

    await queryRunner.connect();
    try {
      await ensureCoreSchemaExists();
      await new AddAduanaProjectionAuditStorageFastInstanceCommand().up(
        queryRunner,
      );
      await ensureAduanaProjectionTableExists();
      await deleteProjectionRows();
    } finally {
      await queryRunner.release();
    }
  });

  afterEach(async () => {
    await deleteAuditRows(eventIdsToDelete.splice(0));
    await deleteAuditRowsByNonces(noncesToDelete.splice(0));
    await deleteProjectionRows();
  });

  it('accepts a signed valid envelope, persists audit data, and does not mutate the generic projection object', async () => {
    const envelope = buildEnvelope();

    eventIdsToDelete.push(envelope.eventId as string);
    const projectionRowsBefore = await countProjectionRows();

    const response = await postSignedEnvelope({ envelope });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      eventId: envelope.eventId,
      status: 'accepted',
      quarantineReason: null,
    });
    expect(response.body.canonicalHash).toEqual(expect.any(String));
    expect(await countProjectionRows()).toBe(projectionRowsBefore);

    const auditRows = await selectAuditRows(envelope.eventId as string);

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      eventId: envelope.eventId,
      rawBody: JSON.stringify(envelope),
      canonicalHash: response.body.canonicalHash,
      status: 'accepted',
      quarantineReason: null,
    });
  });

  it('quarantines an invalid envelope without mutating the generic projection object', async () => {
    const nonce = randomUUID();
    const invalidEnvelope = buildEnvelope({ occurredAt: undefined });

    noncesToDelete.push(nonce);
    const projectionRowsBefore = await countProjectionRows();

    const response = await postSignedEnvelope({
      envelope: invalidEnvelope,
      nonce,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      eventId: null,
      canonicalHash: null,
      status: 'quarantined',
      quarantineReason: 'Missing required Aduana trusted field: occurredAt',
    });
    expect(await countProjectionRows()).toBe(projectionRowsBefore);

    expect(await selectAuditRowByNonce(nonce)).toMatchObject({
      eventId: null,
      rawBody: JSON.stringify(invalidEnvelope),
      canonicalHash: null,
      status: 'quarantined',
      quarantineReason: 'Missing required Aduana trusted field: occurredAt',
      authNonce: nonce,
    });
  });

  it('rejects a tampered signed body without recording receiver impact', async () => {
    const nonce = randomUUID();
    const originalEnvelope = buildEnvelope();
    const tamperedEnvelope = {
      ...originalEnvelope,
      summary: 'Tampered projection summary',
    };
    const originalRawBody = Buffer.from(JSON.stringify(originalEnvelope));
    const tamperedRawBody = Buffer.from(JSON.stringify(tamperedEnvelope));
    const { signature } = signPayload({ rawBody: originalRawBody, nonce });
    const projectionRowsBefore = await countProjectionRows();

    const response = await postRawBody({
      rawBody: tamperedRawBody,
      nonce,
      signature,
    });

    expect(response.status).toBe(401);
    expect(await countProjectionRows()).toBe(projectionRowsBefore);
    expect(await selectAuditRowsByNonce(nonce)).toEqual([]);
  });

  it('rejects an unknown workspace before ingestion without recording receiver impact', async () => {
    const nonce = randomUUID();
    const rawBody = Buffer.from(JSON.stringify(buildEnvelope()));
    const projectionRowsBefore = await countProjectionRows();

    const response = await postRawBody({
      path: UNKNOWN_WORKSPACE_PATH,
      rawBody,
      workspaceId: TEST_WORKSPACE_ID,
      nonce,
    });

    expect(response.status).toBe(401);
    expect(await countProjectionRows()).toBe(projectionRowsBefore);
    expect(await selectAuditRowsByNonce(nonce)).toEqual([]);
  });

  it('rejects malformed JSON before ingestion without recording receiver impact', async () => {
    const nonce = randomUUID();
    const rawBody = Buffer.from('{"eventId":', 'utf8');
    const projectionRowsBefore = await countProjectionRows();

    const response = await postRawBody({ rawBody, nonce });

    expect(response.status).toBe(400);
    expect(await countProjectionRows()).toBe(projectionRowsBefore);
    expect(await selectAuditRowsByNonce(nonce)).toEqual([]);
  });

  it('replays identical envelopes idempotently and quarantines conflicting envelopes without updating the accepted audit row', async () => {
    const eventId = `aduana-receiver-${randomUUID()}`;
    const acceptedEnvelope = buildEnvelope({ eventId });
    const conflictingEnvelope = buildEnvelope({
      eventId,
      summary: 'Conflicting descriptive projection summary',
    });

    eventIdsToDelete.push(eventId);

    const acceptedResponse = await postSignedEnvelope({
      envelope: acceptedEnvelope,
      nonce: randomUUID(),
    });
    const replayedResponse = await postSignedEnvelope({
      envelope: acceptedEnvelope,
      nonce: randomUUID(),
    });
    const conflictResponse = await postSignedEnvelope({
      envelope: conflictingEnvelope,
      nonce: randomUUID(),
    });

    expect(acceptedResponse.body).toMatchObject({
      eventId,
      status: 'accepted',
      quarantineReason: null,
    });
    expect(replayedResponse.body).toMatchObject({
      eventId,
      canonicalHash: acceptedResponse.body.canonicalHash,
      status: 'replayed',
      quarantineReason: null,
    });
    expect(conflictResponse.body).toMatchObject({
      eventId,
      status: 'quarantined',
      quarantineReason: `Conflicting Aduana event replay for eventId ${eventId}`,
    });

    const auditRows = await selectAuditRows(eventId);

    expect(auditRows).toHaveLength(3);
    expect(auditRows.map(({ status }) => status)).toEqual([
      'accepted',
      'replayed',
      'quarantined',
    ]);
    expect(auditRows[0].canonicalHash).toBe(
      acceptedResponse.body.canonicalHash,
    );
    expect(auditRows[1].canonicalHash).toBe(
      acceptedResponse.body.canonicalHash,
    );
    expect(auditRows[2].canonicalHash).not.toBe(
      acceptedResponse.body.canonicalHash,
    );
    expect(auditRows[0].rawBody).toBe(JSON.stringify(acceptedEnvelope));
  });
});
