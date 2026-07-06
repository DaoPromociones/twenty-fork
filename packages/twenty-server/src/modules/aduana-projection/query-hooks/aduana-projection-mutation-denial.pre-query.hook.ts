import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type ResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  PermissionsException,
  PermissionsExceptionCode,
} from 'src/engine/metadata-modules/permissions/permissions.exception';

const ADUANA_PROJECTION_READ_ONLY_ERROR_MESSAGE =
  'Aduana projection records are read-only and can only be written by trusted ingestion.';

abstract class AduanaProjectionMutationDenialPreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(
    _authContext: WorkspaceAuthContext,
    _objectName: string,
    _payload: ResolverArgs,
  ): Promise<ResolverArgs> {
    throw new PermissionsException(
      ADUANA_PROJECTION_READ_ONLY_ERROR_MESSAGE,
      PermissionsExceptionCode.METHOD_NOT_ALLOWED,
    );
  }
}

@WorkspaceQueryHook('aduanaProjection.createOne')
export class AduanaProjectionCreateOnePreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.createMany')
export class AduanaProjectionCreateManyPreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.updateOne')
export class AduanaProjectionUpdateOnePreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.updateMany')
export class AduanaProjectionUpdateManyPreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.deleteOne')
export class AduanaProjectionDeleteOnePreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.deleteMany')
export class AduanaProjectionDeleteManyPreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.destroyOne')
export class AduanaProjectionDestroyOnePreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.destroyMany')
export class AduanaProjectionDestroyManyPreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.restoreOne')
export class AduanaProjectionRestoreOnePreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.restoreMany')
export class AduanaProjectionRestoreManyPreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

@WorkspaceQueryHook('aduanaProjection.mergeMany')
export class AduanaProjectionMergeManyPreQueryHook extends AduanaProjectionMutationDenialPreQueryHook {}

export const ADUANA_PROJECTION_DENIED_MUTATION_HOOKS = [
  {
    key: 'aduanaProjection.createOne',
    Hook: AduanaProjectionCreateOnePreQueryHook,
  },
  {
    key: 'aduanaProjection.createMany',
    Hook: AduanaProjectionCreateManyPreQueryHook,
  },
  {
    key: 'aduanaProjection.updateOne',
    Hook: AduanaProjectionUpdateOnePreQueryHook,
  },
  {
    key: 'aduanaProjection.updateMany',
    Hook: AduanaProjectionUpdateManyPreQueryHook,
  },
  {
    key: 'aduanaProjection.deleteOne',
    Hook: AduanaProjectionDeleteOnePreQueryHook,
  },
  {
    key: 'aduanaProjection.deleteMany',
    Hook: AduanaProjectionDeleteManyPreQueryHook,
  },
  {
    key: 'aduanaProjection.destroyOne',
    Hook: AduanaProjectionDestroyOnePreQueryHook,
  },
  {
    key: 'aduanaProjection.destroyMany',
    Hook: AduanaProjectionDestroyManyPreQueryHook,
  },
  {
    key: 'aduanaProjection.restoreOne',
    Hook: AduanaProjectionRestoreOnePreQueryHook,
  },
  {
    key: 'aduanaProjection.restoreMany',
    Hook: AduanaProjectionRestoreManyPreQueryHook,
  },
  {
    key: 'aduanaProjection.mergeMany',
    Hook: AduanaProjectionMergeManyPreQueryHook,
  },
] as const;
