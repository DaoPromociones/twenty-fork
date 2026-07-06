import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { FieldMetadataType } from 'twenty-shared/types';

import { SEARCH_FIELDS_BY_STANDARD_OBJECT_NAME } from 'src/engine/workspace-manager/twenty-standard-application/constants/search-fields-by-standard-object-name.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';

const WORKSPACE_ID = '20202020-1111-4111-8111-111111111111';
const TWENTY_STANDARD_APPLICATION_ID = '20202020-2222-4222-8222-222222222222';
const NOW = '2024-01-01T00:00:00.000Z';

describe('AduanaProjection core standard metadata build', () => {
  const { allFlatEntityMaps } =
    computeTwentyStandardApplicationAllFlatEntityMaps({
      now: NOW,
      workspaceId: WORKSPACE_ID,
      twentyStandardApplicationId: TWENTY_STANDARD_APPLICATION_ID,
    });

  it('builds the aduanaProjection object as UI read-only projection metadata', () => {
    const aduanaProjection =
      allFlatEntityMaps.flatObjectMetadataMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.aduanaProjection.universalIdentifier
      ];

    expect(aduanaProjection).toMatchObject({
      nameSingular: 'aduanaProjection',
      isSystem: true,
      isUICreatable: false,
      isUIEditable: false,
      labelIdentifierFieldMetadataId:
        allFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier[
          STANDARD_OBJECTS.aduanaProjection.fields.eventId.universalIdentifier
        ]?.id,
    });
  });

  it('registers approved text search fields', () => {
    expect(SEARCH_FIELDS_BY_STANDARD_OBJECT_NAME.aduanaProjection).toEqual([
      { name: 'eventId', type: FieldMetadataType.TEXT },
      { name: 'eventType', type: FieldMetadataType.TEXT },
      { name: 'sourceRecordId', type: FieldMetadataType.TEXT },
      { name: 'evidenceId', type: FieldMetadataType.TEXT },
    ]);
  });

  it('keeps stable object and field universal identifiers', () => {
    expect(STANDARD_OBJECTS.aduanaProjection).toMatchObject({
      universalIdentifier: '06b00f33-b9af-4a2c-9f50-e54e20746463',
      fields: {
        id: { universalIdentifier: '40ab8a3f-f3c9-44c9-a760-d15ac3377cbb' },
        createdAt: {
          universalIdentifier: '77aa2d8f-f5f1-49db-b7e6-9140c2b29c65',
        },
        updatedAt: {
          universalIdentifier: 'ef8771e8-58d2-423a-b653-2e4a7420d07a',
        },
        deletedAt: {
          universalIdentifier: '97d77d99-6438-4a9f-af72-2f4bf9e12ff3',
        },
        eventId: {
          universalIdentifier: '680250e9-6396-4be3-90fd-e0828aab27c1',
        },
        eventType: {
          universalIdentifier: '2a804455-5fc7-40a6-95c1-7f9ce020cf62',
        },
        occurredAt: {
          universalIdentifier: '3fc541b6-7b66-431b-8d01-93cb79a49a36',
        },
        sourceRecordId: {
          universalIdentifier: 'ddf35c1a-4837-4b92-b1f1-04e60517eb72',
        },
        evidenceId: {
          universalIdentifier: 'a54f8b4c-85db-48f0-8bf6-c0bf3c74710a',
        },
        summary: {
          universalIdentifier: '442e2f3f-6184-4a34-9349-e409258cfe3c',
        },
        ingestionStatus: {
          universalIdentifier: 'f29214e8-a3e2-49ec-8459-8c9aa0145e38',
        },
        quarantineReason: {
          universalIdentifier: '0d9b65a8-0b50-4302-a254-1e5a1304e6d9',
        },
        receivedAt: {
          universalIdentifier: 'de96a054-86f7-43b7-ad4e-c452fc1d2456',
        },
        createdBy: {
          universalIdentifier: '601d3213-e4a2-47c8-9d03-fcdf97971918',
        },
        updatedBy: {
          universalIdentifier: '2ac73d50-372f-4c51-8541-b14deedcd8df',
        },
        position: {
          universalIdentifier: '7c7c51bf-14b4-412d-a1cc-cc0fc07225ac',
        },
        searchVector: {
          universalIdentifier: '986d0b9f-13d6-4d33-a7e2-54003d1b91e3',
        },
      },
    });
  });
});
