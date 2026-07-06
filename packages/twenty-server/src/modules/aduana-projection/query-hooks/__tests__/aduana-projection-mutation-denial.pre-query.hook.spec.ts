import { Reflector } from '@nestjs/core';

import { type ResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { WorkspaceQueryHookType } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/types/workspace-query-hook.type';
import { WorkspaceQueryHookMetadataAccessor } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook-metadata.accessor';
import { WorkspaceQueryHookModule } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.module';
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
});
