import {
  STANDARD_OBJECTS,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { WidgetConfigurationType } from 'src/engine/metadata-modules/page-layout-widget/enums/widget-configuration-type.type';
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

describe('AduanaProjection view and page layout standard metadata build', () => {
  const { allFlatEntityMaps } =
    computeTwentyStandardApplicationAllFlatEntityMaps({
      now: NOW,
      workspaceId: WORKSPACE_ID,
      twentyStandardApplicationId: TWENTY_STANDARD_APPLICATION_ID,
    });

  it('keeps table and record-page views limited to approved visible fields', () => {
    const expectedVisibleFieldUniversalIdentifiers =
      APPROVED_ADUANA_PROJECTION_FIELD_NAMES.map(
        (fieldName) =>
          STANDARD_OBJECTS.aduanaProjection.fields[fieldName]
            .universalIdentifier,
      );

    for (const viewUniversalIdentifier of [
      STANDARD_OBJECTS.aduanaProjection.views.allAduanaProjections
        .universalIdentifier,
      STANDARD_OBJECTS.aduanaProjection.views.aduanaProjectionRecordPageFields
        .universalIdentifier,
    ]) {
      const viewFieldFieldUniversalIdentifiers = Object.values(
        allFlatEntityMaps.flatViewFieldMaps.byUniversalIdentifier,
      )
        .filter(isDefined)
        .filter(
          (viewField) =>
            viewField.viewUniversalIdentifier === viewUniversalIdentifier,
        )
        .sort(
          (firstViewField, secondViewField) =>
            firstViewField.position - secondViewField.position,
        )
        .map((viewField) => viewField.fieldMetadataUniversalIdentifier);

      expect(viewFieldFieldUniversalIdentifiers).toEqual(
        expectedVisibleFieldUniversalIdentifiers,
      );
    }
  });

  it('links the aduanaProjection fields widget to its curated record-page fields view', () => {
    const fieldsWidget =
      allFlatEntityMaps.flatPageLayoutWidgetMaps.byUniversalIdentifier[
        STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage
          .tabs.home.widgets.fields.universalIdentifier
      ];

    expect(fieldsWidget?.universalConfiguration).toMatchObject({
      configurationType: WidgetConfigurationType.FIELDS,
      viewUniversalIdentifier:
        STANDARD_OBJECTS.aduanaProjection.views.aduanaProjectionRecordPageFields
          .universalIdentifier,
    });
  });

  it('keeps stable view and page-layout universal identifiers', () => {
    expect(STANDARD_OBJECTS.aduanaProjection.views).toMatchObject({
      allAduanaProjections: {
        universalIdentifier: 'd91a59bb-bda4-466f-bc12-7b4f7797de9a',
        viewFields: {
          eventId: {
            universalIdentifier: 'f0d50a09-eb32-4c3e-ae82-1694cfcb935b',
          },
          eventType: {
            universalIdentifier: '1685f6f3-b1bd-489c-bdcb-f37c93db1365',
          },
          occurredAt: {
            universalIdentifier: 'df347cc2-21ac-41e4-9134-61a5a4205198',
          },
          sourceRecordId: {
            universalIdentifier: 'b8746c09-320f-42b7-a93c-5ad840f982cc',
          },
          evidenceId: {
            universalIdentifier: '95393f18-9773-4f26-bb47-f3df27f892a1',
          },
          summary: {
            universalIdentifier: '0d4c06eb-d94c-48aa-9c2b-27a108194ee1',
          },
          ingestionStatus: {
            universalIdentifier: '0b6cc4e2-f06d-437d-bcb8-ad9ac42c5a18',
          },
          quarantineReason: {
            universalIdentifier: '79038489-1f7f-49cb-9fd6-3d5631f08d0c',
          },
          receivedAt: {
            universalIdentifier: '147ac06b-553d-4e9f-83f9-d4192b9314f0',
          },
        },
      },
      aduanaProjectionRecordPageFields: {
        universalIdentifier: 'cd86149e-6102-48a1-af06-b6a0a72c5b37',
        viewFields: {
          eventId: {
            universalIdentifier: '8f023ff3-0c24-4ae3-a4c9-a7ec0a05553d',
          },
          eventType: {
            universalIdentifier: '903e8c74-642c-49bb-8d24-138bb48aa985',
          },
          occurredAt: {
            universalIdentifier: 'c2bdcbf2-2805-4d8e-af33-d45effef7d80',
          },
          sourceRecordId: {
            universalIdentifier: '88c96dd1-5bd2-4949-a158-d2371811cc77',
          },
          evidenceId: {
            universalIdentifier: 'b03d764b-652d-462a-bb38-3f2f374ac1d9',
          },
          summary: {
            universalIdentifier: '4e941b12-163a-471d-8646-6ed357908e01',
          },
          ingestionStatus: {
            universalIdentifier: '5a37a268-7bc9-4e66-a9c8-8223dad2c3c9',
          },
          quarantineReason: {
            universalIdentifier: 'f55963cb-3e9c-4d5b-96ac-b29e5dd15b51',
          },
          receivedAt: {
            universalIdentifier: '4e71a016-cb41-4764-89f2-e86284045af7',
          },
        },
      },
    });

    expect(
      STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage,
    ).toMatchObject({
      universalIdentifier: '4ba3849e-660a-473f-9256-c7362b04c3e2',
      tabs: {
        home: {
          universalIdentifier: '9b32c611-4905-4981-aa90-a90f455f381b',
          widgets: {
            fields: {
              universalIdentifier: '2c1407fa-2d00-45be-b489-a3d59b9a3d0d',
            },
          },
        },
        timeline: {
          universalIdentifier: '50b1cd97-4160-4e65-a7e1-20c4cf04721c',
          widgets: {
            timeline: {
              universalIdentifier: '87a99077-969b-458d-920f-3767e497c384',
            },
          },
        },
      },
    });
  });
});
