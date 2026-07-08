import { TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'twenty-shared/application';
import {
  STANDARD_OBJECTS,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { makeRestAPIRequest } from 'test/integration/rest/utils/make-rest-api-request.util';
import { extractMetadataItemPayload } from 'test/integration/rest/utils/metadata-rest-api.util';
import { assertRestApiSuccessfulResponse } from 'test/integration/rest/utils/rest-test-assertions.util';

import { getStandardFlatEntitiesToCreateOrThrow } from 'src/database/commands/upgrade-version-command/2-10/utils/get-standard-flat-entities-to-create-or-throw.util';
import { type AllFlatEntityOperationByMetadataName } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-to-create-delete-update.type';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatPageLayoutTab } from 'src/engine/metadata-modules/flat-page-layout-tab/types/flat-page-layout-tab.type';
import { type FlatPageLayoutWidget } from 'src/engine/metadata-modules/flat-page-layout-widget/types/flat-page-layout-widget.type';
import { type FlatPageLayout } from 'src/engine/metadata-modules/flat-page-layout/types/flat-page-layout.type';
import { type FlatSearchFieldMetadata } from 'src/engine/metadata-modules/flat-search-field-metadata/types/flat-search-field-metadata.type';
import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceCacheKeyName } from 'src/engine/workspace-cache/types/workspace-cache-key.type';
import { SEED_APPLE_WORKSPACE_ID } from 'src/engine/workspace-manager/dev-seeder/core/constants/seeder-workspaces.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';

type WorkspaceMigrationValidateBuildAndRunServiceLike = {
  validateBuildAndRunWorkspaceMigration: (args: {
    isSystemBuild: boolean;
    applicationUniversalIdentifier: string;
    workspaceId: string;
    allFlatEntityOperationByMetadataName: AllFlatEntityOperationByMetadataName;
  }) => Promise<
    { status: 'success' } | { status: 'fail'; [key: string]: unknown }
  >;
};

type AduanaProjectionDependentMetadataCompleteness = {
  searchFieldMetadataUniversalIdentifiers: string[];
  viewUniversalIdentifiers: string[];
  viewFieldUniversalIdentifiers: string[];
  pageLayoutUniversalIdentifiers: string[];
  pageLayoutTabUniversalIdentifiers: string[];
  pageLayoutWidgetUniversalIdentifiers: string[];
};

type SyncableMetadataTableName =
  | 'searchFieldMetadata'
  | 'view'
  | 'viewField'
  | 'pageLayout'
  | 'pageLayoutTab'
  | 'pageLayoutWidget';

const getUniversalIdentifiers = (
  entitiesByName: Record<string, { universalIdentifier: string }>,
): string[] =>
  Object.values(entitiesByName).map((entity) => entity.universalIdentifier);

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

const ADUANA_PROJECTION_WORKSPACE_CACHE_KEYS: WorkspaceCacheKeyName[] = [
  'flatObjectMetadataMaps',
  'flatFieldMetadataMaps',
  'flatSearchFieldMetadataMaps',
  'flatViewMaps',
  'flatViewFieldMaps',
  'flatPageLayoutMaps',
  'flatPageLayoutTabMaps',
  'flatPageLayoutWidgetMaps',
];

const ADUANA_PROJECTION_VIEW_UNIVERSAL_IDENTIFIERS = [
  STANDARD_OBJECTS.aduanaProjection.views.allAduanaProjections
    .universalIdentifier,
  STANDARD_OBJECTS.aduanaProjection.views.aduanaProjectionRecordPageFields
    .universalIdentifier,
];

const ADUANA_PROJECTION_VIEW_FIELD_UNIVERSAL_IDENTIFIERS = [
  ...getUniversalIdentifiers(
    STANDARD_OBJECTS.aduanaProjection.views.allAduanaProjections.viewFields,
  ),
  ...getUniversalIdentifiers(
    STANDARD_OBJECTS.aduanaProjection.views.aduanaProjectionRecordPageFields
      .viewFields,
  ),
];

const ADUANA_PROJECTION_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS = [
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage
    .universalIdentifier,
];

const ADUANA_PROJECTION_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIERS = [
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage.tabs
    .home.universalIdentifier,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage.tabs
    .timeline.universalIdentifier,
];

const ADUANA_PROJECTION_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIERS = [
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage.tabs
    .home.widgets.fields.universalIdentifier,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage.tabs
    .timeline.widgets.timeline.universalIdentifier,
];

const ADUANA_PROJECTION_DELETABLE_METADATA_TABLE_NAMES: SyncableMetadataTableName[] = [
  'view',
  'viewField',
  'pageLayout',
  'pageLayoutTab',
  'pageLayoutWidget',
];

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

const selectAduanaProjectionMetadataUniversalIdentifiers = async ({
  tableName,
  universalIdentifiers,
}: {
  tableName: SyncableMetadataTableName;
  universalIdentifiers: string[];
}): Promise<string[]> => {
  if (universalIdentifiers.length === 0) {
    return [];
  }

  const deletedAtClause =
    ADUANA_PROJECTION_DELETABLE_METADATA_TABLE_NAMES.includes(tableName)
      ? 'AND "deletedAt" IS NULL'
      : '';

  const rows = await global.testDataSource.query(
    `SELECT "universalIdentifier"
     FROM core."${tableName}"
     WHERE "workspaceId" = $1
       AND "universalIdentifier" = ANY($2)
       ${deletedAtClause}`,
    [SEED_APPLE_WORKSPACE_ID, universalIdentifiers],
  );

  return rows.map(
    (row: { universalIdentifier: string }) => row.universalIdentifier,
  );
};

const getAduanaProjectionSearchFieldMetadataUniversalIdentifiers = (
  standardFlatSearchFieldMetadataMaps: FlatEntityMaps<FlatSearchFieldMetadata>,
): string[] =>
  Object.values(standardFlatSearchFieldMetadataMaps.byUniversalIdentifier)
    .filter(isDefined)
    .filter(
      (flatSearchFieldMetadata) =>
        flatSearchFieldMetadata.objectMetadataUniversalIdentifier ===
        STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
    )
    .map(
      (flatSearchFieldMetadata) => flatSearchFieldMetadata.universalIdentifier,
    );

const selectAduanaProjectionDependentMetadataCompleteness = async ({
  expectedSearchFieldMetadataUniversalIdentifiers,
}: {
  expectedSearchFieldMetadataUniversalIdentifiers: string[];
}): Promise<AduanaProjectionDependentMetadataCompleteness> => {
  const [
    searchFieldMetadataUniversalIdentifiers,
    viewUniversalIdentifiers,
    viewFieldUniversalIdentifiers,
    pageLayoutUniversalIdentifiers,
    pageLayoutTabUniversalIdentifiers,
    pageLayoutWidgetUniversalIdentifiers,
  ] = await Promise.all([
    selectAduanaProjectionMetadataUniversalIdentifiers({
      tableName: 'searchFieldMetadata',
      universalIdentifiers: expectedSearchFieldMetadataUniversalIdentifiers,
    }),
    selectAduanaProjectionMetadataUniversalIdentifiers({
      tableName: 'view',
      universalIdentifiers: ADUANA_PROJECTION_VIEW_UNIVERSAL_IDENTIFIERS,
    }),
    selectAduanaProjectionMetadataUniversalIdentifiers({
      tableName: 'viewField',
      universalIdentifiers: ADUANA_PROJECTION_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
    }),
    selectAduanaProjectionMetadataUniversalIdentifiers({
      tableName: 'pageLayout',
      universalIdentifiers: ADUANA_PROJECTION_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
    }),
    selectAduanaProjectionMetadataUniversalIdentifiers({
      tableName: 'pageLayoutTab',
      universalIdentifiers:
        ADUANA_PROJECTION_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIERS,
    }),
    selectAduanaProjectionMetadataUniversalIdentifiers({
      tableName: 'pageLayoutWidget',
      universalIdentifiers:
        ADUANA_PROJECTION_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIERS,
    }),
  ]);

  return {
    searchFieldMetadataUniversalIdentifiers,
    viewUniversalIdentifiers,
    viewFieldUniversalIdentifiers,
    pageLayoutUniversalIdentifiers,
    pageLayoutTabUniversalIdentifiers,
    pageLayoutWidgetUniversalIdentifiers,
  };
};

const getMissingAduanaProjectionDependentMetadata = ({
  completeness,
  expectedSearchFieldMetadataUniversalIdentifiers,
}: {
  completeness: AduanaProjectionDependentMetadataCompleteness;
  expectedSearchFieldMetadataUniversalIdentifiers: string[];
}): string[] => {
  const expectedByMetadataName = {
    searchFieldMetadata: expectedSearchFieldMetadataUniversalIdentifiers,
    view: ADUANA_PROJECTION_VIEW_UNIVERSAL_IDENTIFIERS,
    viewField: ADUANA_PROJECTION_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
    pageLayout: ADUANA_PROJECTION_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
    pageLayoutTab: ADUANA_PROJECTION_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIERS,
    pageLayoutWidget:
      ADUANA_PROJECTION_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIERS,
  };

  const existingByMetadataName = {
    searchFieldMetadata: completeness.searchFieldMetadataUniversalIdentifiers,
    view: completeness.viewUniversalIdentifiers,
    viewField: completeness.viewFieldUniversalIdentifiers,
    pageLayout: completeness.pageLayoutUniversalIdentifiers,
    pageLayoutTab: completeness.pageLayoutTabUniversalIdentifiers,
    pageLayoutWidget: completeness.pageLayoutWidgetUniversalIdentifiers,
  };

  return Object.entries(expectedByMetadataName).flatMap(
    ([metadataName, expectedUniversalIdentifiers]) => {
      const existingUniversalIdentifierSet = new Set(
        existingByMetadataName[
          metadataName as keyof typeof existingByMetadataName
        ],
      );

      return expectedUniversalIdentifiers
        .filter(
          (universalIdentifier) =>
            !existingUniversalIdentifierSet.has(universalIdentifier),
        )
        .map((universalIdentifier) => `${metadataName}:${universalIdentifier}`);
    },
  );
};

const selectTwentyStandardFlatApplication = async () => {
  const [row] = await global.testDataSource.query(
    `SELECT id, "universalIdentifier"
     FROM core.application
     WHERE "workspaceId" = $1
       AND "universalIdentifier" = $2
       AND "deletedAt" IS NULL`,
    [SEED_APPLE_WORKSPACE_ID, TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER],
  );

  if (!isDefined(row)) {
    throw new Error('Twenty standard application not found for seed workspace');
  }

  return row as { id: string; universalIdentifier: string };
};

const getWorkspaceMigrationValidateBuildAndRunService = () => {
  const modules = (
    global.app as unknown as {
      container: {
        getModules: () => Map<string, { providers: Map<string, unknown> }>;
      };
    }
  ).container.getModules();

  for (const moduleRef of modules.values()) {
    for (const providerRef of moduleRef.providers.values()) {
      const provider = providerRef as {
        instance?: unknown;
        metatype?: { name?: string };
      };

      if (
        provider.metatype?.name ===
        'WorkspaceMigrationValidateBuildAndRunService'
      ) {
        return provider.instance as WorkspaceMigrationValidateBuildAndRunServiceLike;
      }
    }
  }

  throw new Error('WorkspaceMigrationValidateBuildAndRunService not found');
};

const getAduanaProjectionSearchFieldMetadatasToCreate = ({
  standardFlatSearchFieldMetadataMaps,
  existingFlatSearchFieldMetadataMaps,
}: {
  standardFlatSearchFieldMetadataMaps: FlatEntityMaps<FlatSearchFieldMetadata>;
  existingFlatSearchFieldMetadataMaps: FlatEntityMaps<FlatSearchFieldMetadata>;
}): FlatSearchFieldMetadata[] => {
  const existingSearchFieldMetadataKeys = new Set(
    Object.values(existingFlatSearchFieldMetadataMaps.byUniversalIdentifier)
      .filter(isDefined)
      .map(
        (flatSearchFieldMetadata) =>
          `${flatSearchFieldMetadata.objectMetadataUniversalIdentifier}:${flatSearchFieldMetadata.fieldMetadataUniversalIdentifier}`,
      ),
  );

  return Object.values(
    standardFlatSearchFieldMetadataMaps.byUniversalIdentifier,
  )
    .filter(isDefined)
    .filter(
      (flatSearchFieldMetadata) =>
        flatSearchFieldMetadata.objectMetadataUniversalIdentifier ===
        STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
    )
    .filter(
      (flatSearchFieldMetadata) =>
        !existingSearchFieldMetadataKeys.has(
          `${flatSearchFieldMetadata.objectMetadataUniversalIdentifier}:${flatSearchFieldMetadata.fieldMetadataUniversalIdentifier}`,
        ),
    );
};

const getOperationCount = (
  allFlatEntityOperationByMetadataName: AllFlatEntityOperationByMetadataName,
) =>
  Object.values(allFlatEntityOperationByMetadataName).reduce(
    (total, operations) =>
      total +
      operations.flatEntityToCreate.length +
      operations.flatEntityToUpdate.length,
    0,
  );

const runAduanaProjectionMetadataMigration = async ({
  allFlatEntityOperationByMetadataName,
  phase,
  twentyStandardApplicationUniversalIdentifier,
  workspaceMigrationValidateBuildAndRunService,
}: {
  allFlatEntityOperationByMetadataName: AllFlatEntityOperationByMetadataName;
  phase: string;
  twentyStandardApplicationUniversalIdentifier: string;
  workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunServiceLike;
}) => {
  if (getOperationCount(allFlatEntityOperationByMetadataName) === 0) {
    return;
  }

  const result =
    await workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
      {
        isSystemBuild: true,
        applicationUniversalIdentifier:
          twentyStandardApplicationUniversalIdentifier,
        workspaceId: SEED_APPLE_WORKSPACE_ID,
        allFlatEntityOperationByMetadataName,
      },
    );

  if (result.status === 'fail') {
    throw new Error(
      `Failed to setup AduanaProjection ${phase} metadata: ${JSON.stringify(result, null, 2)}`,
    );
  }
};

const ensureAduanaProjectionMetadata = async () => {
  const workspaceCacheService = global.app.get(WorkspaceCacheService);
  const workspaceMigrationValidateBuildAndRunService =
    getWorkspaceMigrationValidateBuildAndRunService();
  const twentyStandardFlatApplication =
    await selectTwentyStandardFlatApplication();
  const { allFlatEntityMaps: standardMaps } =
    computeTwentyStandardApplicationAllFlatEntityMaps({
      includeAduanaProjection: true,
      now: new Date().toISOString(),
      workspaceId: SEED_APPLE_WORKSPACE_ID,
      twentyStandardApplicationId: twentyStandardFlatApplication.id,
    });
  const expectedSearchFieldMetadataUniversalIdentifiers =
    getAduanaProjectionSearchFieldMetadataUniversalIdentifiers(
      standardMaps.flatSearchFieldMetadataMaps,
    );

  const existingObjectMetadataId =
    await selectAduanaProjectionObjectMetadataId();
  const existingCompleteness =
    await selectAduanaProjectionDependentMetadataCompleteness({
      expectedSearchFieldMetadataUniversalIdentifiers,
    });
  const missingExistingDependentMetadata =
    getMissingAduanaProjectionDependentMetadata({
      completeness: existingCompleteness,
      expectedSearchFieldMetadataUniversalIdentifiers,
    });

  if (
    isDefined(existingObjectMetadataId) &&
    missingExistingDependentMetadata.length === 0
  ) {
    return;
  }

  const existingMaps = await workspaceCacheService.getOrRecompute(
    SEED_APPLE_WORKSPACE_ID,
    ADUANA_PROJECTION_WORKSPACE_CACHE_KEYS,
  );

  await runAduanaProjectionMetadataMigration({
    allFlatEntityOperationByMetadataName: {
      objectMetadata: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatObjectMetadata>({
            standardFlatEntityMaps: standardMaps.flatObjectMetadataMaps,
            existingFlatEntityMaps: existingMaps.flatObjectMetadataMaps,
            universalIdentifiers: [
              STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
            ],
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      fieldMetadata: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatFieldMetadata>({
            standardFlatEntityMaps: standardMaps.flatFieldMetadataMaps,
            existingFlatEntityMaps: existingMaps.flatFieldMetadataMaps,
            universalIdentifiers: getUniversalIdentifiers(
              STANDARD_OBJECTS.aduanaProjection.fields,
            ),
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
    },
    phase: 'core object and field',
    twentyStandardApplicationUniversalIdentifier:
      twentyStandardFlatApplication.universalIdentifier,
    workspaceMigrationValidateBuildAndRunService,
  });

  await workspaceCacheService.invalidateAndRecompute(
    SEED_APPLE_WORKSPACE_ID,
    ADUANA_PROJECTION_WORKSPACE_CACHE_KEYS,
  );
  const recomputedMaps = await workspaceCacheService.getOrRecompute(
    SEED_APPLE_WORKSPACE_ID,
    ADUANA_PROJECTION_WORKSPACE_CACHE_KEYS,
  );

  await runAduanaProjectionMetadataMigration({
    allFlatEntityOperationByMetadataName: {
      searchFieldMetadata: {
        flatEntityToCreate: getAduanaProjectionSearchFieldMetadatasToCreate({
          standardFlatSearchFieldMetadataMaps:
            standardMaps.flatSearchFieldMetadataMaps,
          existingFlatSearchFieldMetadataMaps:
            recomputedMaps.flatSearchFieldMetadataMaps,
        }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      view: {
        flatEntityToCreate: getStandardFlatEntitiesToCreateOrThrow<FlatView>({
          standardFlatEntityMaps: standardMaps.flatViewMaps,
          existingFlatEntityMaps: recomputedMaps.flatViewMaps,
          universalIdentifiers: ADUANA_PROJECTION_VIEW_UNIVERSAL_IDENTIFIERS,
        }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      viewField: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatViewField>({
            standardFlatEntityMaps: standardMaps.flatViewFieldMaps,
            existingFlatEntityMaps: recomputedMaps.flatViewFieldMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      pageLayout: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatPageLayout>({
            standardFlatEntityMaps: standardMaps.flatPageLayoutMaps,
            existingFlatEntityMaps: recomputedMaps.flatPageLayoutMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      pageLayoutTab: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatPageLayoutTab>({
            standardFlatEntityMaps: standardMaps.flatPageLayoutTabMaps,
            existingFlatEntityMaps: recomputedMaps.flatPageLayoutTabMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      pageLayoutWidget: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatPageLayoutWidget>({
            standardFlatEntityMaps: standardMaps.flatPageLayoutWidgetMaps,
            existingFlatEntityMaps: recomputedMaps.flatPageLayoutWidgetMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
    },
    phase: 'dependent search, view, and page layout',
    twentyStandardApplicationUniversalIdentifier:
      twentyStandardFlatApplication.universalIdentifier,
    workspaceMigrationValidateBuildAndRunService,
  });

  await workspaceCacheService.invalidateAndRecompute(
    SEED_APPLE_WORKSPACE_ID,
    ADUANA_PROJECTION_WORKSPACE_CACHE_KEYS,
  );

  const createdCompleteness =
    await selectAduanaProjectionDependentMetadataCompleteness({
      expectedSearchFieldMetadataUniversalIdentifiers,
    });
  const missingCreatedDependentMetadata =
    getMissingAduanaProjectionDependentMetadata({
      completeness: createdCompleteness,
      expectedSearchFieldMetadataUniversalIdentifiers,
    });

  if (missingCreatedDependentMetadata.length > 0) {
    throw new Error(
      `Failed to setup AduanaProjection dependent metadata: missing ${missingCreatedDependentMetadata.join(', ')}`,
    );
  }
};

describe('Aduana projection metadata exposure integration', () => {
  beforeAll(async () => {
    await ensureAduanaProjectionMetadata();
  });

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
