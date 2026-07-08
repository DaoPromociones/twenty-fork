import { type Module } from '@nestjs/core/injector/module';

import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type WorkspaceResolverBuilderMethodNames } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceQueryHookKey } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { WorkspaceQueryHookStorage } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/storage/workspace-query-hook.storage';
import { type WorkspacePreQueryHookPayload } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/types/workspace-query-hook.type';
import { WorkspaceQueryHookExplorer } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.explorer';
import { WorkspaceQueryHookService } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.service';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermissionsExceptionCode } from 'src/engine/metadata-modules/permissions/permissions.exception';
import {
  ADUANA_PROJECTION_DENIED_MUTATION_HOOKS,
  ADUANA_PROJECTION_READ_ONLY_ERROR_MESSAGE,
} from 'src/modules/aduana-projection/query-hooks/aduana-projection-mutation-denial.pre-query.hook';

type StoredAduanaProjectionRow = {
  id: string;
  eventId: string;
  eventType: string;
  summary: string;
  ingestionStatus: 'accepted' | 'quarantined';
  quarantineReason: string | null;
};

type MutationAttempt = {
  entryPoint: 'GraphQL' | 'REST';
  methodName: WorkspaceResolverBuilderMethodNames | CommonQueryNames;
  payload: WorkspacePreQueryHookPayload<
    WorkspaceResolverBuilderMethodNames | CommonQueryNames
  >;
  mutateStoredRows: () => void;
};

describe('Aduana projection mutation denial security', () => {
  const authContext = {
    workspace: { id: 'workspace-id' },
  } as WorkspaceAuthContext;

  const initialStoredRows: StoredAduanaProjectionRow[] = [
    {
      id: 'projection-row-id',
      eventId: 'aduana-event-1',
      eventType: 'evidence.received',
      summary: 'Consultative projection summary from Aduana',
      ingestionStatus: 'accepted',
      quarantineReason: null,
    },
  ];

  let storedRows: StoredAduanaProjectionRow[];

  beforeEach(() => {
    storedRows = structuredClone(initialStoredRows);
  });

  const buildHookService = () => {
    const storage = new WorkspaceQueryHookStorage();
    const explorer = {
      handlePreHook: jest.fn((executeParams, instance) =>
        instance.execute(...executeParams),
      ),
    } as unknown as WorkspaceQueryHookExplorer;

    for (const { key, Hook } of ADUANA_PROJECTION_DENIED_MUTATION_HOOKS) {
      storage.registerWorkspaceQueryPreHookInstance(
        key as WorkspaceQueryHookKey,
        {
          instance: new Hook(),
          host: {} as Module,
          isRequestScoped: false,
        },
      );
    }

    return new WorkspaceQueryHookService(storage, explorer);
  };

  const attemptGenericMutation = async ({
    methodName,
    payload,
    mutateStoredRows,
  }: MutationAttempt) => {
    await buildHookService().executePreQueryHooks(
      authContext,
      'aduanaProjection',
      methodName,
      payload,
    );

    mutateStoredRows();
  };

  it.each<MutationAttempt>([
    {
      entryPoint: 'GraphQL',
      methodName: 'createOne',
      payload: {
        data: {
          eventId: 'manual-event',
          summary: 'Manual summary must not become stored projection truth',
        },
      },
      mutateStoredRows: () => {
        storedRows.push({
          id: 'manual-row',
          eventId: 'manual-event',
          eventType: 'manual.create',
          summary: 'Manual summary must not become stored projection truth',
          ingestionStatus: 'accepted',
          quarantineReason: null,
        });
      },
    },
    {
      entryPoint: 'GraphQL',
      methodName: 'mergeMany',
      payload: {
        ids: ['projection-row-id', 'manual-row-id'],
        conflictPriorityIndex: 0,
      },
      mutateStoredRows: () => {
        storedRows.splice(1, 1);
        storedRows[0].summary = 'Merged manual summary';
      },
    },
    {
      entryPoint: 'REST',
      methodName: CommonQueryNames.UPDATE_ONE,
      payload: {
        id: 'projection-row-id',
        data: {
          summary: 'Forged authoritative summary',
          ingestionStatus: 'quarantined',
        },
      },
      mutateStoredRows: () => {
        storedRows[0].summary = 'Forged authoritative summary';
        storedRows[0].ingestionStatus = 'quarantined';
      },
    },
    {
      entryPoint: 'REST',
      methodName: CommonQueryNames.DESTROY_ONE,
      payload: {
        id: 'projection-row-id',
      },
      mutateStoredRows: () => {
        storedRows = [];
      },
    },
  ])(
    'should reject $entryPoint $methodName and leave stored projection rows unchanged',
    async (mutationAttempt) => {
      const rowsBeforeAttempt = structuredClone(storedRows);

      await expect(
        attemptGenericMutation(mutationAttempt),
      ).rejects.toMatchObject({
        code: PermissionsExceptionCode.METHOD_NOT_ALLOWED,
        message: ADUANA_PROJECTION_READ_ONLY_ERROR_MESSAGE,
      });

      expect(storedRows).toEqual(rowsBeforeAttempt);
    },
  );
});
