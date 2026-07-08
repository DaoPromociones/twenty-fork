import { randomUUID } from 'node:crypto';

import gql from 'graphql-tag';
import { makeGraphqlAPIRequest } from 'test/integration/graphql/utils/make-graphql-api-request.util';
import { makeRestAPIRequest } from 'test/integration/rest/utils/make-rest-api-request.util';

import { ADUANA_PROJECTION_READ_ONLY_ERROR_MESSAGE } from 'src/modules/aduana-projection/query-hooks/aduana-projection-mutation-denial.pre-query.hook';

const TEST_SCHEMA_NAME = 'workspace_1wgvd1injqtife6y4rvfbu3h5';

const ADUANA_PROJECTION_FIELDS = `
  id
  eventId
  eventType
  summary
  ingestionStatus
`;

type AduanaProjectionRow = {
  id: string;
  eventId: string;
  eventType: string;
  occurredAt: Date;
  summary: string | null;
  ingestionStatus: string;
  receivedAt: Date;
  deletedAt: Date | null;
};

const selectAduanaProjectionRow = async (id: string) => {
  const [row] = await global.testDataSource.query(
    `SELECT id, "eventId", "eventType", "occurredAt", summary, "ingestionStatus", "receivedAt", "deletedAt"
     FROM "${TEST_SCHEMA_NAME}"."aduanaProjection"
     WHERE id = $1`,
    [id],
  );

  return row as AduanaProjectionRow | undefined;
};

const doesAduanaProjectionTableExist = async () => {
  const [row] = await global.testDataSource.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = $1
       AND table_name = 'aduanaProjection'
     ) AS "exists"`,
    [TEST_SCHEMA_NAME],
  );

  return row?.exists === true;
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

const insertAduanaProjectionRow = async (id: string) => {
  await global.testDataSource.query(
    `INSERT INTO "${TEST_SCHEMA_NAME}"."aduanaProjection"
       (id, "eventId", "eventType", "occurredAt", "sourceRecordId", "evidenceId", summary, "ingestionStatus", "receivedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACCEPTED', $8)`,
    [
      id,
      'aduana-event-http-1',
      'evidence.received',
      '2026-07-06T10:00:00.000Z',
      'source-record-1',
      'evidence-1',
      'Consultative projection summary from Aduana',
      '2026-07-06T10:01:00.000Z',
    ],
  );
};

const deleteAduanaProjectionRows = async () => {
  if (!(await doesAduanaProjectionTableExist())) {
    return;
  }

  await global.testDataSource.query(
    `DELETE FROM "${TEST_SCHEMA_NAME}"."aduanaProjection"`,
  );
};

describe('Aduana projection mutation denial integration', () => {
  const projectionId = randomUUID();

  beforeEach(async () => {
    await ensureAduanaProjectionTableExists();
    await deleteAduanaProjectionRows();
    await insertAduanaProjectionRow(projectionId);
  });

  afterAll(async () => {
    await deleteAduanaProjectionRows();
  });

  it('rejects GraphQL update mutations and leaves the stored projection row unchanged', async () => {
    const rowBeforeMutation = await selectAduanaProjectionRow(projectionId);

    const response = await makeGraphqlAPIRequest({
      query: gql`
        mutation UpdateAduanaProjection($id: UUID!, $data: AduanaProjectionUpdateInput!) {
          updateAduanaProjection(id: $id, data: $data) {
            ${ADUANA_PROJECTION_FIELDS}
          }
        }
      `,
      variables: {
        id: projectionId,
        data: {
          summary: 'Forged authoritative summary',
          ingestionStatus: 'QUARANTINED',
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.updateAduanaProjection).toBeNull();
    expect(response.body.errors[0].message).toBe(
      ADUANA_PROJECTION_READ_ONLY_ERROR_MESSAGE,
    );
    expect(await selectAduanaProjectionRow(projectionId)).toEqual(
      rowBeforeMutation,
    );
  });

  it('rejects REST update mutations and leaves the stored projection row unchanged', async () => {
    const rowBeforeMutation = await selectAduanaProjectionRow(projectionId);

    const response = await makeRestAPIRequest({
      method: 'patch',
      path: `/aduanaProjections/${projectionId}`,
      body: {
        summary: 'Forged authoritative summary',
        ingestionStatus: 'QUARANTINED',
      },
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(600);
    expect(await selectAduanaProjectionRow(projectionId)).toEqual(
      rowBeforeMutation,
    );
  });
});
