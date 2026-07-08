import { InjectDataSource } from '@nestjs/typeorm';

import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { DataSource } from 'typeorm';

import { ActiveOrSuspendedWorkspaceCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { getStandardFlatEntitiesToCreateOrThrow } from 'src/database/commands/upgrade-version-command/2-10/utils/get-standard-flat-entities-to-create-or-throw.util';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { isFlatFieldMetadataOfType } from 'src/engine/metadata-modules/flat-field-metadata/utils/is-flat-field-metadata-of-type.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { WorkspaceSchemaManagerService } from 'src/engine/twenty-orm/workspace-schema-manager/workspace-schema-manager.service';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';
import { getWorkspaceSchemaContextForMigration } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/get-workspace-schema-context-for-migration.util';
import { deriveSearchVectorAsExpressionForTsVectorField } from 'src/engine/metadata-modules/flat-search-field-metadata/utils/derive-search-vector-as-expression-for-ts-vector-field.util';
import { getTargetSearchFieldMetadatasForTsVectorField } from 'src/engine/metadata-modules/flat-search-field-metadata/utils/get-target-search-field-metadatas-for-ts-vector-field.util';
import { generateColumnDefinitions } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/generate-column-definitions.util';
import {
  collectEnumOperationsForObject,
  type CreateEnumOperationSpec,
  EnumOperation,
  executeBatchEnumOperations,
} from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/workspace-schema-enum-operations.util';

const ids = (entities?: Record<string, { universalIdentifier: string }>) =>
  Object.values(entities ?? {}).map(
    ({ universalIdentifier }) => universalIdentifier,
  );

const ADUANA_OBJECT_IDS = [
  STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
];
const ADUANA_FIELD_IDS = ids(STANDARD_OBJECTS.aduanaProjection.fields);

@RegisteredWorkspaceCommand('2.19.0', 1783506438000)
@Command({
  name: 'upgrade:2-19:sync-aduana-projection-standard-object',
  description:
    'Create or repair AduanaProjection standard metadata and workspace table for existing workspaces',
})
export class SyncAduanaProjectionStandardObjectCommand extends ActiveOrSuspendedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceSchemaManagerService: WorkspaceSchemaManagerService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({ workspaceId, options }: RunOnWorkspaceArgs) {
    const isDryRun = options.dryRun ?? false;

    if (!isDryRun && !(await this.doesWorkspaceSchemaExist(workspaceId))) {
      this.logger.log(
        `Workspace schema does not exist for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );
    const existingMaps = await this.workspaceCacheService.getOrRecompute(
      workspaceId,
      [
        'flatObjectMetadataMaps',
        'flatFieldMetadataMaps',
        'flatSearchFieldMetadataMaps',
      ],
    );
    const { allFlatEntityMaps: standardMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        includeAduanaProjection: true,
        now: new Date().toISOString(),
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const existingAduanaObject =
      existingMaps.flatObjectMetadataMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.aduanaProjection.universalIdentifier
      ];
    const missingTableRepaired =
      isDefined(existingAduanaObject) &&
      !isDryRun &&
      !(await this.doesWorkspaceTableExist({
        workspaceId,
        existingAduanaObject,
      }))
        ? await this.repairMissingWorkspaceTable({
            workspaceId,
            objectMetadata: existingAduanaObject,
            fieldMetadatas: Object.values(
              existingMaps.flatFieldMetadataMaps.byUniversalIdentifier,
            ).filter(
              (field): field is FlatFieldMetadata =>
                isDefined(field) &&
                field.objectMetadataId === existingAduanaObject.id,
            ),
            flatSearchFieldMetadataMaps:
              existingMaps.flatSearchFieldMetadataMaps,
          })
        : false;

    const operations = {
      objectMetadata: {
        flatEntityToCreate: getStandardFlatEntitiesToCreateOrThrow({
          standardFlatEntityMaps: standardMaps.flatObjectMetadataMaps,
          existingFlatEntityMaps: existingMaps.flatObjectMetadataMaps,
          universalIdentifiers: ADUANA_OBJECT_IDS,
        }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      fieldMetadata: {
        flatEntityToCreate: getStandardFlatEntitiesToCreateOrThrow({
          standardFlatEntityMaps: standardMaps.flatFieldMetadataMaps,
          existingFlatEntityMaps: existingMaps.flatFieldMetadataMaps,
          universalIdentifiers: ADUANA_FIELD_IDS,
        }),
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
    };
    const operationCount = Object.values(operations).reduce(
      (count, operation) => count + operation.flatEntityToCreate.length,
      0,
    );

    if (operationCount === 0) {
      this.logger.log(
        missingTableRepaired
          ? `Repaired AduanaProjection workspace table for workspace ${workspaceId}`
          : `AduanaProjection standard metadata already exists for workspace ${workspaceId}`,
      );

      return;
    }
    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would apply ${operationCount} AduanaProjection standard metadata operations for workspace ${workspaceId}`,
      );

      return;
    }
    const result =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          isSystemBuild: true,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
          workspaceId,
          allFlatEntityOperationByMetadataName: operations,
        },
      );

    if (result.status === 'fail') {
      throw new Error(
        `Failed to sync AduanaProjection standard metadata for workspace ${workspaceId}: ${JSON.stringify(result, null, 2)}`,
      );
    }
  }

  private async doesWorkspaceSchemaExist(workspaceId: string) {
    const schemaName = getWorkspaceSchemaName(workspaceId);
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const rows = await queryRunner.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS "exists"`,
        [schemaName],
      );

      return rows[0]?.exists === true;
    } finally {
      await queryRunner.release();
    }
  }

  private async doesWorkspaceTableExist({
    workspaceId,
    existingAduanaObject,
  }: {
    workspaceId: string;
    existingAduanaObject: FlatObjectMetadata;
  }) {
    const { schemaName, tableName } = getWorkspaceSchemaContextForMigration({
      workspaceId,
      objectMetadata: existingAduanaObject,
    });
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const rows = await queryRunner.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2) AS "exists"`,
        [schemaName, tableName],
      );

      return rows[0]?.exists === true;
    } finally {
      await queryRunner.release();
    }
  }

  private async repairMissingWorkspaceTable({
    workspaceId,
    objectMetadata,
    fieldMetadatas,
    flatSearchFieldMetadataMaps,
  }: {
    workspaceId: string;
    objectMetadata: FlatObjectMetadata;
    fieldMetadatas: FlatFieldMetadata[];
    flatSearchFieldMetadataMaps: Parameters<
      typeof getTargetSearchFieldMetadatasForTsVectorField
    >[0]['flatSearchFieldMetadataMaps'];
  }) {
    const { schemaName, tableName } = getWorkspaceSchemaContextForMigration({
      workspaceId,
      objectMetadata,
    });

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const enumOperations = collectEnumOperationsForObject({
        flatFieldMetadatas: fieldMetadatas,
        tableName,
        operation: EnumOperation.CREATE,
      });
      const existingEnumNames = await this.getExistingEnumNames({
        enumNames: enumOperations
          .filter(
            (enumOperation): enumOperation is CreateEnumOperationSpec =>
              enumOperation.operation === EnumOperation.CREATE,
          )
          .map(({ enumName }) => enumName),
        queryRunner,
        schemaName,
      });

      await executeBatchEnumOperations({
        enumOperations: enumOperations.filter(
          (enumOperation) =>
            enumOperation.operation !== EnumOperation.CREATE ||
            !existingEnumNames.has(enumOperation.enumName),
        ),
        queryRunner,
        schemaName,
        workspaceSchemaManagerService: this.workspaceSchemaManagerService,
      });
      const indexedFieldById = new Map(
        fieldMetadatas.map((field) => [field.id, field]),
      );

      await this.workspaceSchemaManagerService.tableManager.createTable({
        queryRunner,
        schemaName,
        tableName,
        columnDefinitions: fieldMetadatas.flatMap((flatFieldMetadata) =>
          generateColumnDefinitions({
            flatFieldMetadata,
            flatObjectMetadata: objectMetadata,
            workspaceId,
            searchVectorAsExpression: isFlatFieldMetadataOfType(
              flatFieldMetadata,
              FieldMetadataType.TS_VECTOR,
            )
              ? deriveSearchVectorAsExpressionForTsVectorField({
                  targetSearchFieldMetadatas:
                    getTargetSearchFieldMetadatasForTsVectorField({
                      tsVectorFieldMetadataId: flatFieldMetadata.id,
                      flatSearchFieldMetadataMaps,
                    }),
                  indexedFieldById,
                })
              : undefined,
          }),
        ),
      });

      return true;
    } finally {
      await queryRunner.release();
    }
  }

  private async getExistingEnumNames({
    enumNames,
    queryRunner,
    schemaName,
  }: {
    enumNames: string[];
    queryRunner: ReturnType<DataSource['createQueryRunner']>;
    schemaName: string;
  }) {
    if (enumNames.length === 0) {
      return new Set<string>();
    }

    const rows: Array<{ enumName?: unknown }> = await queryRunner.query(
      `SELECT t.typname AS "enumName" FROM pg_type t INNER JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = $1 AND t.typname = ANY($2)`,
      [schemaName, enumNames],
    );

    return new Set(
      rows
        .map((row) => row.enumName)
        .filter((enumName): enumName is string => typeof enumName === 'string'),
    );
  }
}
