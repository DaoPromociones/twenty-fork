import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { DateDisplayFormat, FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';

const WORKSPACE_ID = '20202020-1111-4111-8111-111111111111';
const TWENTY_STANDARD_APPLICATION_ID = '20202020-2222-4222-8222-222222222222';
const NOW = '2024-01-01T00:00:00.000Z';

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

const INTERNAL_STANDARD_FIELD_NAMES = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'createdBy',
  'updatedBy',
  'position',
  'searchVector',
] as const;

describe('AduanaProjection field standard metadata build', () => {
  const { allFlatEntityMaps } =
    computeTwentyStandardApplicationAllFlatEntityMaps({
      includeAduanaProjection: true,
      now: NOW,
      workspaceId: WORKSPACE_ID,
      twentyStandardApplicationId: TWENTY_STANDARD_APPLICATION_ID,
    });

  it('defines only approved projection fields plus internal standard fields', () => {
    const aduanaProjectionFields = Object.values(
      allFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter(
        (fieldMetadata) =>
          fieldMetadata.objectMetadataUniversalIdentifier ===
          STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
      );

    expect(aduanaProjectionFields.map(({ name }) => name).sort()).toEqual(
      [
        ...APPROVED_ADUANA_PROJECTION_FIELD_NAMES,
        ...INTERNAL_STANDARD_FIELD_NAMES,
      ].sort(),
    );

    for (const fieldName of APPROVED_ADUANA_PROJECTION_FIELD_NAMES) {
      const field = aduanaProjectionFields.find(
        ({ name }) => name === fieldName,
      );

      expect(field).toMatchObject({
        universalIdentifier:
          STANDARD_OBJECTS.aduanaProjection.fields[fieldName]
            .universalIdentifier,
        isUIEditable: false,
      });
    }

    for (const rejectedFieldName of [
      'rawEnvelope',
      'authMetadata',
      'canonicalPayloadHash',
    ]) {
      expect(
        aduanaProjectionFields.find(({ name }) => name === rejectedFieldName),
      ).toBeUndefined();
    }
  });

  it('uses expected field types for projection timestamps and status fields', () => {
    const fieldsByUniversalIdentifier =
      allFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier;

    for (const [fieldName, fieldType] of [
      ['summary', FieldMetadataType.TEXT],
      ['occurredAt', FieldMetadataType.DATE_TIME],
      ['receivedAt', FieldMetadataType.DATE_TIME],
      ['ingestionStatus', FieldMetadataType.SELECT],
    ] as const) {
      expect(
        fieldsByUniversalIdentifier[
          STANDARD_OBJECTS.aduanaProjection.fields[fieldName]
            .universalIdentifier
        ]?.type,
      ).toBe(fieldType);
    }
  });

  it('uses the expected external ingestion status metadata contract', () => {
    const ingestionStatusField =
      allFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.aduanaProjection.fields.ingestionStatus
          .universalIdentifier
      ];

    expect(ingestionStatusField?.defaultValue).toBe("'ACCEPTED'");
    expect(ingestionStatusField?.options?.map(({ value }) => value)).toEqual([
      'ACCEPTED',
      'REPLAYED',
      'QUARANTINED',
    ]);
  });

  it('uses relative display format for standard timestamp fields', () => {
    const fieldsByUniversalIdentifier =
      allFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier;

    for (const fieldName of ['createdAt', 'updatedAt', 'deletedAt'] as const) {
      expect(
        fieldsByUniversalIdentifier[
          STANDARD_OBJECTS.aduanaProjection.fields[fieldName]
            .universalIdentifier
        ]?.settings,
      ).toEqual({ displayFormat: DateDisplayFormat.RELATIVE });
    }
  });
});
