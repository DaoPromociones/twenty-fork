import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';

import { AduanaProjectionReceiverProofModule } from 'src/aduana-projection-receiver-proof/aduana-projection-receiver-proof.module';

const FAKE_WORKSPACE_ID = '20202020-1c25-4d02-bf25-6aeccf7ea419';
const FAKE_SECRET = 'fake-aduana-projection-secret';
const HOST = '127.0.0.1';
const PORT = 4000;
const READY_MARKER = 'ADUANA_LIVE_SURFACE_READY';

type ProofConfig = {
  workspaceId: string;
  secret: string;
  pgDatabaseUrl: string;
  timeoutMs: number | null;
};

type RunnerPhase = 'config-validation' | 'bootstrap' | 'listen' | 'shutdown';

const parseArgs = (args: string[]) => ({
  validateConfigOnly: args.includes('--validate-config'),
});

const printJson = (payload: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const sanitizeMessage = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message : String(error);

  return rawMessage
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, 'postgres://[redacted]')
    .replace(FAKE_SECRET, '[fake-secret-redacted]');
};

const fail = (phase: RunnerPhase, error: unknown): never => {
  printJson({
    marker: 'ADUANA_LIVE_SURFACE_ERROR',
    phase,
    message: sanitizeMessage(error),
  });

  process.exit(1);
};

const requireFakeSecretMap = (): Pick<
  ProofConfig,
  'workspaceId' | 'secret'
> => {
  const configuredSecrets = process.env.ADUANA_PROJECTION_WORKSPACE_SECRETS;

  if (configuredSecrets === undefined || configuredSecrets.length === 0) {
    throw new Error('ADUANA_PROJECTION_WORKSPACE_SECRETS is required.');
  }

  const secretsByWorkspace = JSON.parse(configuredSecrets) as Record<
    string,
    string
  >;
  const entries = Object.entries(secretsByWorkspace);

  if (
    entries.length !== 1 ||
    entries[0]?.[0] !== FAKE_WORKSPACE_ID ||
    entries[0]?.[1] !== FAKE_SECRET
  ) {
    throw new Error(
      'This proof runner only accepts the fake Aduana workspace and fake secret.',
    );
  }

  return { workspaceId: FAKE_WORKSPACE_ID, secret: FAKE_SECRET };
};

const requireLocalPostgresUrl = (): string => {
  const pgDatabaseUrl = process.env.PG_DATABASE_URL;

  if (pgDatabaseUrl === undefined || pgDatabaseUrl.length === 0) {
    throw new Error('PG_DATABASE_URL is required and must be explicit.');
  }

  const parsedUrl = new URL(pgDatabaseUrl);
  const allowedHosts = new Set(['127.0.0.1', 'localhost', '::1']);

  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error('PG_DATABASE_URL must use postgres/postgresql protocol.');
  }

  if (!allowedHosts.has(parsedUrl.hostname)) {
    throw new Error('PG_DATABASE_URL must point to a local Postgres host.');
  }

  return pgDatabaseUrl;
};

const parseTimeoutMs = (): number | null => {
  const rawTimeoutMs = process.env.ADUANA_RECEIVER_PROOF_TIMEOUT_MS;

  if (rawTimeoutMs === undefined || rawTimeoutMs.length === 0) {
    return null;
  }

  const timeoutMs = Number(rawTimeoutMs);

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      'ADUANA_RECEIVER_PROOF_TIMEOUT_MS must be a positive integer.',
    );
  }

  return timeoutMs;
};

export const validateAduanaReceiverProofConfig = (): ProofConfig => {
  if (process.env.TWENTY_DISABLE_DOTENV !== 'true') {
    throw new Error('TWENTY_DISABLE_DOTENV=true is required.');
  }

  const { workspaceId, secret } = requireFakeSecretMap();

  return {
    workspaceId,
    secret,
    pgDatabaseUrl: requireLocalPostgresUrl(),
    timeoutMs: parseTimeoutMs(),
  };
};

const buildColmenaProofCommand = (endpoint: string): string =>
  [
    'cd /home/macala/colmenaOS',
    `COLMENA_TWENTY_PROOF_ENDPOINT=${endpoint}`,
    `COLMENA_TWENTY_PROOF_WORKSPACE_ID=${FAKE_WORKSPACE_ID}`,
    `COLMENA_TWENTY_PROOF_SECRET=${FAKE_SECRET}`,
    'python scripts/prove_twenty_projection_delivery.py',
  ].join(' ');

export const startAduanaReceiverProof = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  let app: NestExpressApplication | null = null;
  let shutdownStarted = false;

  const config = validateAduanaReceiverProofConfig();
  const endpoint = `http://${HOST}:${PORT}/webhooks/aduana/projection/${config.workspaceId}`;

  if (args.validateConfigOnly) {
    printJson({
      marker: 'ADUANA_LIVE_SURFACE_CONFIG_VALID',
      endpoint,
      workspace: config.workspaceId,
      noDotenv: true,
      fakeBoundary: true,
      boundedModule: 'AduanaProjectionReceiverProofModule',
    });

    return;
  }

  const closeApp = async (
    signal: NodeJS.Signals | 'timeout',
  ): Promise<void> => {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    try {
      await app?.close();
      printJson({ marker: 'ADUANA_LIVE_SURFACE_CLOSED', signal });
      process.exit(0);
    } catch (error) {
      fail('shutdown', error);
    }
  };

  process.once('SIGINT', (signal) => void closeApp(signal));
  process.once('SIGTERM', (signal) => void closeApp(signal));

  try {
    app = await NestFactory.create<NestExpressApplication>(
      AduanaProjectionReceiverProofModule,
      {
        abortOnError: false,
        logger: false,
        rawBody: true,
      },
    );
  } catch (error) {
    fail('bootstrap', error);
  }

  const receiverApp = app!;

  try {
    await receiverApp.listen(PORT, HOST);
  } catch (error) {
    fail('listen', error);
  }

  printJson({
    marker: READY_MARKER,
    endpoint,
    workspace: config.workspaceId,
    noDotenv: true,
    fakeBoundary: true,
    bind: `${HOST}:${PORT}`,
    boundedModule: 'AduanaProjectionReceiverProofModule',
    colmenaCommand: buildColmenaProofCommand(endpoint),
  });

  if (config.timeoutMs !== null) {
    setTimeout(() => void closeApp('timeout'), config.timeoutMs);
  }
};

void startAduanaReceiverProof().catch((error) =>
  fail('config-validation', error),
);
