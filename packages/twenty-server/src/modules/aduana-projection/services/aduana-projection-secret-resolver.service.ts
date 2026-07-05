import { Injectable } from '@nestjs/common';

export type AduanaProjectionSecretResolver = {
  getSecretForWorkspace(workspaceId: string): string | undefined;
};

@Injectable()
export class AduanaProjectionSecretResolverService implements AduanaProjectionSecretResolver {
  getSecretForWorkspace(workspaceId: string): string | undefined {
    const configuredSecrets = process.env.ADUANA_PROJECTION_WORKSPACE_SECRETS;

    if (configuredSecrets === undefined || configuredSecrets.length === 0) {
      return undefined;
    }

    const secretsByWorkspace = JSON.parse(configuredSecrets) as Record<
      string,
      string
    >;

    return secretsByWorkspace[workspaceId];
  }
}
