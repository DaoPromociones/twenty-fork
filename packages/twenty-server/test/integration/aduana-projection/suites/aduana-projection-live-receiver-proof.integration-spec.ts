import { createHmac, randomUUID } from 'node:crypto';

import request from 'supertest';

import { AddAduanaProjectionAuditStorageFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-19/2-19-instance-command-fast-1783517693762-add-aduana-projection-audit-storage';
import { buildAduanaProjectionSignaturePayload } from 'src/modules/aduana-projection/services/aduana-projection-signature.service';

const TEST_WORKSPACE_ID = '20202020-1c25-4d02-bf25-6aeccf7ea419';
const TEST_SCHEMA_NAME = 'workspace_1wgvd1injqtife6y4rvfbu3h5';
const TEST_SECRET = 'fake-aduana-projection-secret';
const RECEIVER_PATH = `/webhooks/aduana/projection/${TEST_WORKSPACE_ID}`;

const buildKaiCompatibleEnvelope = () => ({
  eventId: `aduana-live-receiver-proof-${randomUUID()}`,
  eventType: 'evidence.received',
  occurredAt: '2026-07-06T10:00:00.000Z',
  sourceRecordId: 'kai-source-record-1',
  evidenceId: 'kai-evidence-1',
  summary: 'Kai live receiver proof envelope',
});

const signPayload = ({ rawBody, nonce }: { rawBody: Buffer; nonce: string }) => {
  const timestamp = new Date().toISOString();
  const payload = buildAduanaProjectionSignaturePayload({
    method: 'POST',
    path: RECEIVER_PATH,
    workspaceId: TEST_WORKSPACE_ID,
    timestamp,
    nonce,
    rawBody,
  });

  return {
    timestamp,
    signature: createHmac('sha256', TEST_SECRET).update(payload).digest('hex'),
  };
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

const deleteAuditRows = async (eventId: string) => {
  await global.testDataSource.query(
    `DELETE FROM core."aduanaProjectionAudit"
     WHERE "workspaceId" = $1 AND "eventId" = $2`,
    [TEST_WORKSPACE_ID, eventId],
  );
};

const deleteProjectionRows = async () => {
  await global.testDataSource.query(
    `DELETE FROM "${TEST_SCHEMA_NAME}"."aduanaProjection"`,
  );
};

describe('Aduana projection live receiver proof', () => {
  const eventIdsToDelete: string[] = [];

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
    await Promise.all(eventIdsToDelete.splice(0).map(deleteAuditRows));
    await deleteProjectionRows();
  });

  it('exposes the live localhost HTTP listener and accepts a Kai-compatible signed envelope', async () => {
    const envelope = buildKaiCompatibleEnvelope();
    const rawBody = Buffer.from(JSON.stringify(envelope));
    const nonce = randomUUID();
    const { signature, timestamp } = signPayload({ rawBody, nonce });

    eventIdsToDelete.push(envelope.eventId);

    const response = await request(`http://localhost:${APP_PORT}`)
      .post(RECEIVER_PATH)
      .set('Content-Type', 'application/json')
      .set('X-Aduana-Workspace-Id', TEST_WORKSPACE_ID)
      .set('X-Aduana-Timestamp', timestamp)
      .set('X-Aduana-Nonce', nonce)
      .set('X-Aduana-Signature', `sha256=${signature}`)
      .send(rawBody.toString('utf8'));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      eventId: envelope.eventId,
      status: 'accepted',
      quarantineReason: null,
    });
    expect(response.body.canonicalHash).toEqual(expect.any(String));
  });
});
