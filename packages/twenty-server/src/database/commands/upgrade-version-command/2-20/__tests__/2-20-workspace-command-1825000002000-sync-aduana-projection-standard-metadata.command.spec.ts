import { TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'twenty-shared/application';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { type WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { SyncAduanaProjectionStandardMetadataCommand } from 'src/database/commands/upgrade-version-command/2-20/2-20-workspace-command-1825000002000-sync-aduana-projection-standard-metadata.command';
import { V2_20_UpgradeVersionCommandModule } from 'src/database/commands/upgrade-version-command/2-20/2-20-upgrade-version-command.module';
import { type ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type FlatCommandMenuItem } from 'src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item.type';
import { buildNavigationFlatCommandMenuItem } from 'src/engine/metadata-modules/flat-command-menu-item/utils/build-navigation-flat-command-menu-item.util';
import { createEmptyFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type AllFlatEntityOperationByMetadataName } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-to-create-delete-update.type';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatSearchFieldMetadata } from 'src/engine/metadata-modules/flat-search-field-metadata/types/flat-search-field-metadata.type';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { SEARCH_FIELDS_BY_STANDARD_OBJECT_NAME } from 'src/engine/workspace-manager/twenty-standard-application/constants/search-fields-by-standard-object-name.constant';
import { type WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const WORKSPACE_ID = '20202020-0000-0000-0000-000000000001';
const STANDARD_APPLICATION_ID = '20202020-0000-0000-0000-0000000000a1';
const STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER =
  '20202020-0000-0000-0000-0000000000a2';
const NOW = '2026-07-07T00:00:00.000Z';

type ValidateBuildAndRunWorkspaceMigrationArgs = Parameters<
  WorkspaceMigrationValidateBuildAndRunService['validateBuildAndRunWorkspaceMigration']
>[0];

type ValidateBuildAndRunWorkspaceMigrationResult = Awaited<
  ReturnType<
    WorkspaceMigrationValidateBuildAndRunService['validateBuildAndRunWorkspaceMigration']
  >
>;

const successResult = {
  status: 'success',
  hasSchemaMetadataChanged: true,
  workspaceMigration: { actions: [] },
} as ValidateBuildAndRunWorkspaceMigrationResult;

const buildFlatObjectMetadataMaps = (
  flatObjectMetadatas: FlatObjectMetadata[],
): FlatEntityMaps<FlatObjectMetadata> => ({
  byUniversalIdentifier: Object.fromEntries(
    flatObjectMetadatas.map((flatObjectMetadata) => [
      flatObjectMetadata.universalIdentifier,
      flatObjectMetadata,
    ]),
  ),
  universalIdentifierById: Object.fromEntries(
    flatObjectMetadatas.map((flatObjectMetadata) => [
      flatObjectMetadata.id,
      flatObjectMetadata.universalIdentifier,
    ]),
  ),
  universalIdentifiersByApplicationId: {},
});

const buildFlatCommandMenuItemMaps = (
  flatCommandMenuItems: FlatCommandMenuItem[],
): FlatEntityMaps<FlatCommandMenuItem> => ({
  byUniversalIdentifier: Object.fromEntries(
    flatCommandMenuItems.map((flatCommandMenuItem) => [
      flatCommandMenuItem.universalIdentifier,
      flatCommandMenuItem,
    ]),
  ),
  universalIdentifierById: Object.fromEntries(
    flatCommandMenuItems.map((flatCommandMenuItem) => [
      flatCommandMenuItem.id,
      flatCommandMenuItem.universalIdentifier,
    ]),
  ),
  universalIdentifiersByApplicationId: {},
});

describe('SyncAduanaProjectionStandardMetadataCommand', () => {
  let command: SyncAduanaProjectionStandardMetadataCommand;
  let getOrRecompute: jest.Mock;
  let validateBuildAndRunWorkspaceMigration: jest.Mock<
    Promise<ValidateBuildAndRunWorkspaceMigrationResult>,
    [ValidateBuildAndRunWorkspaceMigrationArgs]
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    getOrRecompute = jest.fn().mockResolvedValue({
      flatObjectMetadataMaps: createEmptyFlatEntityMaps(),
      flatFieldMetadataMaps: createEmptyFlatEntityMaps(),
      flatSearchFieldMetadataMaps: createEmptyFlatEntityMaps(),
      flatViewMaps: createEmptyFlatEntityMaps(),
      flatViewFieldMaps: createEmptyFlatEntityMaps(),
      flatPageLayoutMaps: createEmptyFlatEntityMaps(),
      flatPageLayoutTabMaps: createEmptyFlatEntityMaps(),
      flatPageLayoutWidgetMaps: createEmptyFlatEntityMaps(),
      flatCommandMenuItemMaps: createEmptyFlatEntityMaps(),
    });

    const findWorkspaceTwentyStandardAndCustomApplicationOrThrow = jest
      .fn()
      .mockResolvedValue({
        twentyStandardFlatApplication: {
          id: STANDARD_APPLICATION_ID,
          universalIdentifier: STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        },
      });

    validateBuildAndRunWorkspaceMigration = jest
      .fn()
      .mockResolvedValue(successResult);

    command = new SyncAduanaProjectionStandardMetadataCommand(
      {} as WorkspaceIteratorService,
      {
        findWorkspaceTwentyStandardAndCustomApplicationOrThrow,
      } as unknown as ApplicationService,
      { getOrRecompute } as unknown as WorkspaceCacheService,
      {
        validateBuildAndRunWorkspaceMigration,
      } as unknown as WorkspaceMigrationValidateBuildAndRunService,
    );

    jest.spyOn(command['logger'], 'log').mockImplementation();
  });

  it('builds complete AduanaProjection metadata operations including searchFieldMetadata', async () => {
    await command.runOnWorkspace({
      workspaceId: WORKSPACE_ID,
      options: {},
      index: 0,
      total: 1,
    });

    expect(getOrRecompute).toHaveBeenCalledWith(WORKSPACE_ID, [
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

    const migrationArgs = validateBuildAndRunWorkspaceMigration.mock.calls[0]?.[0];

    expect(migrationArgs).toBeDefined();
    expect(migrationArgs?.workspaceId).toBe(WORKSPACE_ID);
    expect(migrationArgs?.isSystemBuild).toBe(true);
    expect(migrationArgs?.applicationUniversalIdentifier).toBe(
      STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    );

    const operations = migrationArgs
      ?.allFlatEntityOperationByMetadataName as AllFlatEntityOperationByMetadataName;

    expect(Object.keys(operations).sort()).toEqual([
      'commandMenuItem',
      'fieldMetadata',
      'objectMetadata',
      'pageLayout',
      'pageLayoutTab',
      'pageLayoutWidget',
      'searchFieldMetadata',
      'view',
      'viewField',
    ]);

    const searchFieldMetadataToCreate = operations.searchFieldMetadata
      ?.flatEntityToCreate as FlatSearchFieldMetadata[];

    expect(searchFieldMetadataToCreate).toHaveLength(
      SEARCH_FIELDS_BY_STANDARD_OBJECT_NAME.aduanaProjection.length,
    );
    expect(searchFieldMetadataToCreate).toEqual(
      expect.arrayContaining(
        SEARCH_FIELDS_BY_STANDARD_OBJECT_NAME.aduanaProjection.map(
          ({ name }) =>
            expect.objectContaining({
              objectMetadataUniversalIdentifier:
                STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
              fieldMetadataUniversalIdentifier:
                STANDARD_OBJECTS.aduanaProjection.fields[name].universalIdentifier,
            }),
        ),
      ),
    );
  });

  it('renames custom AduanaProjection name collisions before creating standard metadata', async () => {
    jest.useFakeTimers().setSystemTime(new Date(NOW));

    const collidingObjectMetadata = getFlatObjectMetadataMock({
      id: 'custom-aduana-projection-object-id',
      universalIdentifier: 'custom-aduana-projection-object',
      nameSingular: 'aduanaProjection',
      namePlural: 'aduanaProjections',
      labelSingular: 'Aduana Projection',
      labelPlural: 'Aduana Projections',
    });

    getOrRecompute.mockResolvedValueOnce({
      flatObjectMetadataMaps: buildFlatObjectMetadataMaps([
        collidingObjectMetadata,
      ]),
      flatFieldMetadataMaps: createEmptyFlatEntityMaps(),
      flatSearchFieldMetadataMaps: createEmptyFlatEntityMaps(),
      flatViewMaps: createEmptyFlatEntityMaps(),
      flatViewFieldMaps: createEmptyFlatEntityMaps(),
      flatPageLayoutMaps: createEmptyFlatEntityMaps(),
      flatPageLayoutTabMaps: createEmptyFlatEntityMaps(),
      flatPageLayoutWidgetMaps: createEmptyFlatEntityMaps(),
      flatCommandMenuItemMaps: buildFlatCommandMenuItemMaps([
        buildNavigationFlatCommandMenuItem({
          objectMetadata: collidingObjectMetadata,
          commandMenuItemId: 'custom-aduana-projection-navigation-item-id',
          applicationId: STANDARD_APPLICATION_ID,
          applicationUniversalIdentifier:
            TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
          workspaceId: WORKSPACE_ID,
          position: 0,
          now: NOW,
        }),
      ]),
    });

    try {
      await command.runOnWorkspace({
        workspaceId: WORKSPACE_ID,
        options: {},
        index: 0,
        total: 1,
      });
    } finally {
      jest.useRealTimers();
    }

    const migrationArgs = validateBuildAndRunWorkspaceMigration.mock.calls[0]?.[0];
    const operations = migrationArgs
      ?.allFlatEntityOperationByMetadataName as AllFlatEntityOperationByMetadataName;

    expect(operations.objectMetadata.flatEntityToCreate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          universalIdentifier:
            STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
          nameSingular: 'aduanaProjection',
          namePlural: 'aduanaProjections',
        }),
      ]),
    );
    expect(operations.objectMetadata.flatEntityToUpdate).toEqual([
      expect.objectContaining({
        universalIdentifier: 'custom-aduana-projection-object',
        nameSingular: 'aduanaProjectionOld',
        namePlural: 'aduanaProjectionsOld',
        labelSingular: 'Aduana Projection (Old)',
        labelPlural: 'Aduana Projections (Old)',
        isLabelSyncedWithName: false,
        updatedAt: NOW,
      }),
    ]);
    expect(operations.commandMenuItem.flatEntityToUpdate).toEqual([
      expect.objectContaining({
        conditionalAvailabilityExpression:
          'targetObjectReadPermissions.aduanaProjectionOld',
        updatedAt: NOW,
      }),
    ]);
  });

  it('registers the workspace command in the 2.20 upgrade module', () => {
    const providers = Reflect.getMetadata(
      'providers',
      V2_20_UpgradeVersionCommandModule,
    ) as unknown;

    expect(providers).toContain(SyncAduanaProjectionStandardMetadataCommand);
  });
});
