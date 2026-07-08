import { SyncAduanaProjectionStandardObjectCommand } from 'src/database/commands/upgrade-version-command/2-19/2-19-workspace-command-1825000002000-sync-aduana-projection-standard-object.command';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';

const workspaceId = '20202020-1c25-4d02-bf25-6aeccf7ea419';
const applicationId = 'twenty-standard-application-id';
const runArgs = { workspaceId, options: {}, index: 0, total: 1 };
const dryRunArgs = { ...runArgs, options: { dryRun: true } };

const buildStandardMaps = () =>
  computeTwentyStandardApplicationAllFlatEntityMaps({
    includeAduanaProjection: true,
    now: '2026-01-01T00:00:00.000Z',
    workspaceId,
    twentyStandardApplicationId: applicationId,
  }).allFlatEntityMaps;

const buildEmptyMaps = () =>
  Object.fromEntries(
    Object.keys(buildStandardMaps()).map((key) => [
      key,
      { byUniversalIdentifier: {}, universalIdentifierById: {} },
    ]),
  ) as ReturnType<typeof buildStandardMaps>;

const buildCommand = ({
  schemaExists = true,
  tableExists,
  standardMetadataExists,
  migrationResult = { status: 'success' },
}: {
  schemaExists?: boolean;
  tableExists: boolean;
  standardMetadataExists: boolean;
  migrationResult?: { status: 'success' } | { status: 'fail'; reason: string };
}) => {
  const queryRunner = {
    query: jest.fn(async (query: string) => [
      {
        exists: query.includes('information_schema.schemata')
          ? schemaExists
          : tableExists,
      },
    ]),
    release: jest.fn(),
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const validateBuildAndRunWorkspaceMigration = jest
    .fn()
    .mockResolvedValue(migrationResult);
  const findWorkspaceTwentyStandardAndCustomApplicationOrThrow = jest.fn(
    async () => ({
      twentyStandardFlatApplication: {
        id: applicationId,
        universalIdentifier: 'twenty-standard-application',
      },
    }),
  );
  const getOrRecompute = jest.fn(async () =>
    standardMetadataExists ? buildStandardMaps() : buildEmptyMaps(),
  );
  const schemaManager = {
    enumManager: { createEnum: jest.fn() },
    tableManager: { createTable: jest.fn() },
  };
  const command = new SyncAduanaProjectionStandardObjectCommand(
    {} as never,
    {
      findWorkspaceTwentyStandardAndCustomApplicationOrThrow,
    } as never,
    {
      getOrRecompute,
    } as never,
    { validateBuildAndRunWorkspaceMigration } as never,
    schemaManager as never,
    dataSource as never,
  );

  return {
    command,
    dataSource,
    findWorkspaceTwentyStandardAndCustomApplicationOrThrow,
    getOrRecompute,
    queryRunner,
    schemaManager,
    validateBuildAndRunWorkspaceMigration,
  };
};

const expectNoSchemaOrMigrationMutation = (
  setup: ReturnType<typeof buildCommand>,
) => {
  expect(setup.validateBuildAndRunWorkspaceMigration).not.toHaveBeenCalled();
  expect(setup.schemaManager.enumManager.createEnum).not.toHaveBeenCalled();
  expect(setup.schemaManager.tableManager.createTable).not.toHaveBeenCalled();
};

describe('SyncAduanaProjectionStandardObjectCommand', () => {
  it('does not mutate metadata or repair tables during dry runs', async () => {
    const missingMetadata = buildCommand({
      tableExists: false,
      standardMetadataExists: false,
    });

    await missingMetadata.command.runOnWorkspace(dryRunArgs);

    expect(missingMetadata.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expectNoSchemaOrMigrationMutation(missingMetadata);
  });

  it('creates missing Aduana projection metadata through workspace migration validation', async () => {
    const missingMetadata = buildCommand({
      tableExists: true,
      standardMetadataExists: false,
    });

    await missingMetadata.command.runOnWorkspace(runArgs);

    expect(
      missingMetadata.validateBuildAndRunWorkspaceMigration,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        allFlatEntityOperationByMetadataName: expect.objectContaining({
          fieldMetadata: expect.objectContaining({
            flatEntityToCreate: expect.arrayContaining([
              expect.objectContaining({ name: 'eventId' }),
              expect.objectContaining({ name: 'ingestionStatus' }),
            ]),
          }),
          objectMetadata: expect.objectContaining({
            flatEntityToCreate: expect.arrayContaining([
              expect.objectContaining({ nameSingular: 'aduanaProjection' }),
            ]),
          }),
        }),
        isSystemBuild: true,
        workspaceId,
      }),
    );
  });

  it('skips metadata sync and schema repair when the physical workspace schema is missing', async () => {
    const missingSchema = buildCommand({
      schemaExists: false,
      tableExists: false,
      standardMetadataExists: false,
    });

    await missingSchema.command.runOnWorkspace(runArgs);

    expect(missingSchema.queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('information_schema.schemata'),
      ['workspace_1wgvd1injqtife6y4rvfbu3h5'],
    );
    expect(
      missingSchema.findWorkspaceTwentyStandardAndCustomApplicationOrThrow,
    ).not.toHaveBeenCalled();
    expect(missingSchema.getOrRecompute).not.toHaveBeenCalled();
    expectNoSchemaOrMigrationMutation(missingSchema);
  });

  it('does not repair schema or run migrations when metadata and table already exist', async () => {
    const existingTable = buildCommand({
      tableExists: true,
      standardMetadataExists: true,
    });

    await existingTable.command.runOnWorkspace(runArgs);

    expect(existingTable.queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('information_schema.tables'),
      ['workspace_1wgvd1injqtife6y4rvfbu3h5', 'aduanaProjection'],
    );
    expect(existingTable.queryRunner.release).toHaveBeenCalledTimes(2);
    expectNoSchemaOrMigrationMutation(existingTable);
  });

  it('propagates workspace migration failures with workspace context', async () => {
    const missingMetadata = buildCommand({
      tableExists: true,
      standardMetadataExists: false,
      migrationResult: { status: 'fail', reason: 'invalid metadata operation' },
    });

    await expect(missingMetadata.command.runOnWorkspace(runArgs)).rejects.toThrow(
      `Failed to sync AduanaProjection standard metadata for workspace ${workspaceId}`,
    );
  });

  it('syncs metadata and repairs a missing physical workspace table', async () => {
    const missingTable = buildCommand({
      tableExists: false,
      standardMetadataExists: true,
    });

    await missingTable.command.runOnWorkspace(runArgs);

    expect(missingTable.schemaManager.enumManager.createEnum).toHaveBeenCalledWith(
      expect.objectContaining({
        enumName: 'aduanaProjection_ingestionStatus_enum',
        values: ['ACCEPTED', 'REPLAYED', 'QUARANTINED'],
      }),
    );
    expect(missingTable.schemaManager.tableManager.createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        columnDefinitions: expect.arrayContaining([
          expect.objectContaining({ name: 'eventId' }),
          expect.objectContaining({ name: 'ingestionStatus' }),
          expect.objectContaining({ name: 'searchVector' }),
        ]),
        schemaName: 'workspace_1wgvd1injqtife6y4rvfbu3h5',
        tableName: 'aduanaProjection',
      }),
    );
  });
});
