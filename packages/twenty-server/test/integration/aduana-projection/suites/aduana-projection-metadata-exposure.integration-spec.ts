import { makeRestAPIRequest } from 'test/integration/rest/utils/make-rest-api-request.util';
import { extractMetadataItemPayload } from 'test/integration/rest/utils/metadata-rest-api.util';
import { assertRestApiSuccessfulResponse } from 'test/integration/rest/utils/rest-test-assertions.util';

import { SEED_APPLE_WORKSPACE_ID } from 'src/engine/workspace-manager/dev-seeder/core/constants/seeder-workspaces.constant';

const APPROVED_ADUANA_PROJECTION_FIELD_NAMES = [
  'eventId',
  'eventType',
  'occurredAt',
  'sourceRecordId',
  'evidenceId',
  'summary',
  'ingestionStatus',
  'quarantineReason',
  'receivedAt',
] as const;

const PLATFORM_STANDARD_FIELD_NAMES = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'createdBy',
  'updatedBy',
  'position',
  'searchVector',
] as const;

const FORBIDDEN_ADUANA_PROJECTION_FIELD_NAMES = [
  'rawEnvelope',
  'authMetadata',
  'authTimestamp',
  'authNonce',
  'signature',
  'canonicalPayload',
  'canonicalPayloadHash',
  'canonicalHash',
  'auditId',
  'auditStatus',
  'workspaceId',
  'sourceWorkspaceId',
  'createdBySource',
  'updatedBySource',
] as const;

type AduanaProjectionObjectMetadata = {
  id: string;
  nameSingular: string;
  isUICreatable: boolean;
  isUIEditable: boolean;
  isRemote: boolean;
  fields: Array<{
    name: string;
    isUIEditable: boolean;
  }>;
};

const selectAduanaProjectionObjectMetadataId = async () => {
  const [row] = await global.testDataSource.query(
    `SELECT id
     FROM core."objectMetadata"
     WHERE "workspaceId" = $1
       AND "nameSingular" = 'aduanaProjection'`,
    [SEED_APPLE_WORKSPACE_ID],
  );

  return row?.id as string | undefined;
};

const selectAduanaProjectionViewFieldNames = async () => {
  const rows = await global.testDataSource.query(
    `SELECT fm.name, vf.position
     FROM core."view" v
     JOIN core."viewField" vf ON vf."viewId" = v.id AND vf."deletedAt" IS NULL
     JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
     JOIN core."objectMetadata" om ON om.id = v."objectMetadataId"
     WHERE om."workspaceId" = $1
       AND om."nameSingular" = 'aduanaProjection'
       AND v."deletedAt" IS NULL
     ORDER BY v.key, vf.position`,
    [SEED_APPLE_WORKSPACE_ID],
  );

  return rows.map((row: { name: string }) => row.name);
};

describe('Aduana projection metadata exposure integration', () => {
  it('exposes the REST object metadata as read-only and without audit/auth/canonical fields', async () => {
    const objectMetadataId = await selectAduanaProjectionObjectMetadataId();

    expect(objectMetadataId).toEqual(expect.any(String));

    const response = await makeRestAPIRequest({
      method: 'get',
      path: `/metadata/objects/${objectMetadataId}`,
      bearer: APPLE_JANE_ADMIN_ACCESS_TOKEN,
    });

    assertRestApiSuccessfulResponse(response);

    const aduanaProjection =
      extractMetadataItemPayload<AduanaProjectionObjectMetadata>(
        response.body,
        'object',
      );
    const exposedFieldNames = aduanaProjection.fields.map(({ name }) => name);

    expect(aduanaProjection).toMatchObject({
      nameSingular: 'aduanaProjection',
      isUICreatable: false,
      isUIEditable: false,
      isRemote: true,
    });
    expect(exposedFieldNames.sort()).toEqual(
      [
        ...APPROVED_ADUANA_PROJECTION_FIELD_NAMES,
        ...PLATFORM_STANDARD_FIELD_NAMES,
      ].sort(),
    );
    expect(
      FORBIDDEN_ADUANA_PROJECTION_FIELD_NAMES.filter((fieldName) =>
        exposedFieldNames.includes(fieldName),
      ),
    ).toEqual([]);
    expect(
      aduanaProjection.fields
        .filter(({ name }) =>
          APPROVED_ADUANA_PROJECTION_FIELD_NAMES.includes(
            name as (typeof APPROVED_ADUANA_PROJECTION_FIELD_NAMES)[number],
          ),
        )
        .map(({ isUIEditable }) => isUIEditable),
    ).toEqual(APPROVED_ADUANA_PROJECTION_FIELD_NAMES.map(() => false));
  });

  it('limits workspace views to approved projection fields only', async () => {
    const viewFieldNames = await selectAduanaProjectionViewFieldNames();

    expect(viewFieldNames).toHaveLength(
      APPROVED_ADUANA_PROJECTION_FIELD_NAMES.length * 2,
    );
    expect(viewFieldNames).toEqual([
      ...APPROVED_ADUANA_PROJECTION_FIELD_NAMES,
      ...APPROVED_ADUANA_PROJECTION_FIELD_NAMES,
    ]);
    expect(
      FORBIDDEN_ADUANA_PROJECTION_FIELD_NAMES.filter((fieldName) =>
        viewFieldNames.includes(fieldName),
      ),
    ).toEqual([]);
    expect(
      PLATFORM_STANDARD_FIELD_NAMES.filter((fieldName) =>
        viewFieldNames.includes(fieldName),
      ),
    ).toEqual([]);
  });
});
