import { type Module } from '@nestjs/core/injector/module';
import { Reflector } from '@nestjs/core';

import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { type ResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { WorkspaceQueryHookStorage } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/storage/workspace-query-hook.storage';
import { WorkspaceQueryHookType } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/types/workspace-query-hook.type';
import { WorkspaceQueryHookExplorer } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.explorer';
import { WorkspaceQueryHookMetadataAccessor } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook-metadata.accessor';
import { WorkspaceQueryHookModule } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.module';
import { WorkspaceQueryHookService } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.service';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { PermissionsExceptionCode } from 'src/engine/metadata-modules/permissions/permissions.exception';
import { ADUANA_PROJECTION_DENIED_MUTATION_HOOKS } from 'src/modules/aduana-projection/query-hooks/aduana-projection-mutation-denial.pre-query.hook';
import { AduanaProjectionQueryHookModule } from 'src/modules/aduana-projection/query-hooks/aduana-projection-query-hook.module';

describe('AduanaProjectionMutationDenialPreQueryHook', () => {
  const expectedHookKeys = [
    'aduanaProjection.createOne',
    'aduanaProjection.createMany',
    'aduanaProjection.updateOne',
    'aduanaProjection.updateMany',
    'aduanaProjection.deleteOne',
    'aduanaProjection.deleteMany',
    'aduanaProjection.destroyOne',
    'aduanaProjection.destroyMany',
    'aduanaProjection.restoreOne',
    'aduanaProjection.restoreMany',
    'aduanaProjection.mergeMany',
  ];

  const authContext = {
    workspace: { id: 'workspace-id' },
  } as WorkspaceAuthContext;

  const payload = { id: 'record-id' } as ResolverArgs;

  it('should register an explicit pre-query hook for every mutable Aduana projection operation', () => {
    const metadataAccessor = new WorkspaceQueryHookMetadataAccessor(
      new Reflector(),
    );

    const registeredHookKeys = ADUANA_PROJECTION_DENIED_MUTATION_HOOKS.map(
      ({ Hook }) => metadataAccessor.getWorkspaceQueryHookMetadata(Hook)?.key,
    );

    expect(registeredHookKeys).toEqual(expectedHookKeys);
    expect(ADUANA_PROJECTION_DENIED_MUTATION_HOOKS).toHaveLength(
      expectedHookKeys.length,
    );

    for (const { Hook } of ADUANA_PROJECTION_DENIED_MUTATION_HOOKS) {
      expect(metadataAccessor.getWorkspaceQueryHookMetadata(Hook)?.type).toBe(
        WorkspaceQueryHookType.PRE_HOOK,
      );
    }
  });

  it.each(expectedHookKeys)(
    'should deny %s before generic query execution mutates stored projection rows',
    async (hookKey) => {
      const Hook = ADUANA_PROJECTION_DENIED_MUTATION_HOOKS.find(
        (hookDefinition) => hookDefinition.key === hookKey,
      )?.Hook;

      expect(Hook).toBeDefined();

      await expect(
        new Hook!().execute(authContext, 'aduanaProjection', payload),
      ).rejects.toMatchObject({
        code: PermissionsExceptionCode.METHOD_NOT_ALLOWED,
      });
    },
  );

  it('should import the Aduana projection hook module into the workspace query hook discovery module', () => {
    const importedModules = Reflect.getMetadata(
      'imports',
      WorkspaceQueryHookModule,
    );

    expect(importedModules).toContain(AduanaProjectionQueryHookModule);
  });

  it.each([
    CommonQueryNames.CREATE_ONE,
    CommonQueryNames.CREATE_MANY,
    CommonQueryNames.UPDATE_ONE,
    CommonQueryNames.UPDATE_MANY,
    CommonQueryNames.DELETE_ONE,
    CommonQueryNames.DELETE_MANY,
    CommonQueryNames.DESTROY_ONE,
    CommonQueryNames.DESTROY_MANY,
    CommonQueryNames.RESTORE_ONE,
    CommonQueryNames.RESTORE_MANY,
    CommonQueryNames.MERGE_MANY,
  ])(
    'should reject Aduana projection %s through the workspace query runner pre-hook surface',
    async (mutationMethod) => {
      const workspaceQueryHookStorage = new WorkspaceQueryHookStorage();
      const workspaceQueryHookExplorer = {
        handlePreHook: async (
          executeParams: Parameters<WorkspacePreQueryHookInstance['execute']>,
          instance: WorkspacePreQueryHookInstance,
        ) => instance.execute(...executeParams),
      } as unknown as WorkspaceQueryHookExplorer;

      for (const { key, Hook } of ADUANA_PROJECTION_DENIED_MUTATION_HOOKS) {
        workspaceQueryHookStorage.registerWorkspaceQueryPreHookInstance(key, {
          instance: new Hook(),
          host: {} as Module,
          isRequestScoped: false,
        });
      }

      const workspaceQueryHookService = new WorkspaceQueryHookService(
        workspaceQueryHookStorage,
        workspaceQueryHookExplorer,
      );

      await expect(
        workspaceQueryHookService.executePreQueryHooks(
          authContext,
          'aduanaProjection',
          mutationMethod,
          payload,
        ),
      ).rejects.toMatchObject({
        code: PermissionsExceptionCode.METHOD_NOT_ALLOWED,
      });
    },
  );
});
