import { Command } from 'nest-commander';
import {
  STANDARD_OBJECTS,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { ActiveOrSuspendedWorkspaceCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { buildNavigationCommandMenuItemOperationsOrThrow } from 'src/database/commands/upgrade-version-command/2-10/utils/build-navigation-command-menu-item-operations-or-throw.util';
import {
  getExistingOrStandardFlatEntityOrThrow,
  getStandardFlatEntitiesToCreateOrThrow,
} from 'src/database/commands/upgrade-version-command/2-10/utils/get-standard-flat-entities-to-create-or-throw.util';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
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
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const getUniversalIdentifiers = (
  entitiesByName: Record<string, { universalIdentifier: string }>,
): string[] =>
  Object.values(entitiesByName).map((entity) => entity.universalIdentifier);

const ADUANA_PROJECTION_OBJECT_METADATA_UNIVERSAL_IDENTIFIERS = [
  STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
];

const ADUANA_PROJECTION_NAME_SINGULAR = 'aduanaProjection';
const ADUANA_PROJECTION_NAME_PLURAL = 'aduanaProjections';
const ADUANA_PROJECTION_OLD_NAME_SINGULAR = 'aduanaProjectionOld';
const ADUANA_PROJECTION_OLD_NAME_PLURAL = 'aduanaProjectionsOld';
const MAX_OLD_NAME_ATTEMPTS = 100;

const findAduanaProjectionObjectNameCollisions = (
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>,
): FlatObjectMetadata[] =>
  Object.values(flatObjectMetadataMaps.byUniversalIdentifier).filter(
    (flatObjectMetadata): flatObjectMetadata is FlatObjectMetadata =>
      isDefined(flatObjectMetadata) &&
      flatObjectMetadata.universalIdentifier !==
        STANDARD_OBJECTS.aduanaProjection.universalIdentifier &&
      [flatObjectMetadata.nameSingular, flatObjectMetadata.namePlural].some(
        (name) =>
          name === ADUANA_PROJECTION_NAME_SINGULAR ||
          name === ADUANA_PROJECTION_NAME_PLURAL,
      ),
  );

const resolveAvailableOldAduanaProjectionObjectNames = (
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>,
  additionalTakenNames: ReadonlySet<string> = new Set(),
): {
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
} => {
  const takenNames = new Set([
    ...Object.values(flatObjectMetadataMaps.byUniversalIdentifier)
      .filter(isDefined)
      .flatMap((flatObjectMetadata) => [
        flatObjectMetadata.nameSingular,
        flatObjectMetadata.namePlural,
      ]),
    ...additionalTakenNames,
  ]);

  for (let attempt = 0; attempt < MAX_OLD_NAME_ATTEMPTS; attempt++) {
    const discriminator = attempt === 0 ? '' : `${attempt + 1}`;
    const nameSingular = `${ADUANA_PROJECTION_OLD_NAME_SINGULAR}${discriminator}`;
    const namePlural = `${ADUANA_PROJECTION_OLD_NAME_PLURAL}${discriminator}`;

    if (!takenNames.has(nameSingular) && !takenNames.has(namePlural)) {
      const labelSuffix = discriminator === '' ? '' : ` ${discriminator}`;

      return {
        nameSingular,
        namePlural,
        labelSingular: `Aduana Projection (Old)${labelSuffix}`,
        labelPlural: `Aduana Projections (Old)${labelSuffix}`,
      };
    }
  }

  throw new Error(
    `Could not find an available aduanaProjectionOld name after ${MAX_OLD_NAME_ATTEMPTS} attempts`,
  );
};

const buildAduanaProjectionObjectRenameUpdates = ({
  flatObjectMetadataMaps,
  now,
}: {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  now: string;
}): FlatObjectMetadata[] => {
  const reservedOldNames = new Set<string>();

  return findAduanaProjectionObjectNameCollisions(flatObjectMetadataMaps).map(
    (collidingObjectMetadata) => {
      const { nameSingular, namePlural, labelSingular, labelPlural } =
        resolveAvailableOldAduanaProjectionObjectNames(
          flatObjectMetadataMaps,
          reservedOldNames,
        );

      reservedOldNames.add(nameSingular);
      reservedOldNames.add(namePlural);

      return {
        ...collidingObjectMetadata,
        nameSingular,
        namePlural,
        labelSingular,
        labelPlural,
        isLabelSyncedWithName: false,
        updatedAt: now,
      };
    },
  );
};

const ADUANA_PROJECTION_FIELD_METADATA_UNIVERSAL_IDENTIFIERS =
  getUniversalIdentifiers(STANDARD_OBJECTS.aduanaProjection.fields);

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

  return Object.values(standardFlatSearchFieldMetadataMaps.byUniversalIdentifier)
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
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage.tabs.home
    .universalIdentifier,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage.tabs
    .timeline.universalIdentifier,
];

const ADUANA_PROJECTION_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIERS = [
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage.tabs.home
    .widgets.fields.universalIdentifier,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.aduanaProjectionRecordPage.tabs
    .timeline.widgets.timeline.universalIdentifier,
];

@RegisteredWorkspaceCommand('2.20.0', 1825000002000)
@Command({
  name: 'upgrade:2-20:sync-aduana-projection-standard-metadata',
  description:
    'Create the AduanaProjection standard metadata in existing workspaces',
})
export class SyncAduanaProjectionStandardMetadataCommand extends ActiveOrSuspendedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const {
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatSearchFieldMetadataMaps,
      flatViewMaps,
      flatViewFieldMaps,
      flatPageLayoutMaps,
      flatPageLayoutTabMaps,
      flatPageLayoutWidgetMaps,
      flatCommandMenuItemMaps,
    } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
      'flatObjectMetadataMaps',
      'flatFieldMetadataMaps',
      'flatSearchFieldMetadataMaps',
      'flatViewMaps',
      'flatViewFieldMaps',
      'flatPageLayoutMaps',
      'flatPageLayoutTabMaps',
      'flatPageLayoutWidgetMaps',
      'flatCommandMenuItemMaps',
    ]);

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const now = new Date().toISOString();

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now,
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const objectMetadataRenameUpdates =
      buildAduanaProjectionObjectRenameUpdates({
        flatObjectMetadataMaps,
        now,
      });
    const renamedCollisionObjectMetadatas = objectMetadataRenameUpdates.map(
      (objectMetadata) => ({
        universalIdentifier: objectMetadata.universalIdentifier,
        nameSingular: objectMetadata.nameSingular,
      }),
    );

    const aduanaProjectionObjectMetadataForNavigation =
      getExistingOrStandardFlatEntityOrThrow<FlatObjectMetadata>({
        standardFlatEntityMaps: standardAllFlatEntityMaps.flatObjectMetadataMaps,
        existingFlatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier: STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
      });

    const navigationCommandMenuItemOperations =
      buildNavigationCommandMenuItemOperationsOrThrow({
        existingFlatCommandMenuItemMaps: flatCommandMenuItemMaps,
        objectMetadatasForNavigation: [
          aduanaProjectionObjectMetadataForNavigation,
        ],
        applicationId: twentyStandardFlatApplication.id,
        workspaceId,
        now,
        renamedCollisionObjectMetadatas,
      });

    const allFlatEntityOperationByMetadataName = {
      objectMetadata: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatObjectMetadata>({
            standardFlatEntityMaps:
              standardAllFlatEntityMaps.flatObjectMetadataMaps,
            existingFlatEntityMaps: flatObjectMetadataMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_OBJECT_METADATA_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: objectMetadataRenameUpdates,
      },
      fieldMetadata: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatFieldMetadata>({
            standardFlatEntityMaps:
              standardAllFlatEntityMaps.flatFieldMetadataMaps,
            existingFlatEntityMaps: flatFieldMetadataMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_FIELD_METADATA_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      searchFieldMetadata: {
        flatEntityToCreate: getAduanaProjectionSearchFieldMetadatasToCreate({
          standardFlatSearchFieldMetadataMaps:
            standardAllFlatEntityMaps.flatSearchFieldMetadataMaps,
          existingFlatSearchFieldMetadataMaps: flatSearchFieldMetadataMaps,
        }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      view: {
        flatEntityToCreate: getStandardFlatEntitiesToCreateOrThrow<FlatView>({
          standardFlatEntityMaps: standardAllFlatEntityMaps.flatViewMaps,
          existingFlatEntityMaps: flatViewMaps,
          universalIdentifiers: ADUANA_PROJECTION_VIEW_UNIVERSAL_IDENTIFIERS,
        }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      viewField: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatViewField>({
            standardFlatEntityMaps: standardAllFlatEntityMaps.flatViewFieldMaps,
            existingFlatEntityMaps: flatViewFieldMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      pageLayout: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatPageLayout>({
            standardFlatEntityMaps: standardAllFlatEntityMaps.flatPageLayoutMaps,
            existingFlatEntityMaps: flatPageLayoutMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      pageLayoutTab: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatPageLayoutTab>({
            standardFlatEntityMaps:
              standardAllFlatEntityMaps.flatPageLayoutTabMaps,
            existingFlatEntityMaps: flatPageLayoutTabMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      pageLayoutWidget: {
        flatEntityToCreate:
          getStandardFlatEntitiesToCreateOrThrow<FlatPageLayoutWidget>({
            standardFlatEntityMaps:
              standardAllFlatEntityMaps.flatPageLayoutWidgetMaps,
            existingFlatEntityMaps: flatPageLayoutWidgetMaps,
            universalIdentifiers:
              ADUANA_PROJECTION_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIERS,
          }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      commandMenuItem: navigationCommandMenuItemOperations,
    };

    const totalOperationCount = Object.values(
      allFlatEntityOperationByMetadataName,
    ).reduce(
      (total, operations) =>
        total +
        operations.flatEntityToCreate.length +
        operations.flatEntityToUpdate.length,
      0,
    );

    if (totalOperationCount === 0) {
      this.logger.log(
        `AduanaProjection standard metadata already exists for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would apply ${totalOperationCount} AduanaProjection standard metadata operations for workspace ${workspaceId}`,
      );

      return;
    }

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          isSystemBuild: true,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
          workspaceId,
          allFlatEntityOperationByMetadataName,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to create AduanaProjection standard metadata for workspace ${workspaceId}: ${JSON.stringify(
          validateAndBuildResult,
          null,
          2,
        )}`,
      );
    }

    this.logger.log(
      `Applied ${totalOperationCount} AduanaProjection standard metadata operations for workspace ${workspaceId}`,
    );
  }
}
