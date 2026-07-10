const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SCRIPT = 'packages/twenty-server/scripts/start-aduana-receiver-proof.js';
const FAKE_POSTGRES_USER = 'proof_user';
const FAKE_POSTGRES_PASSWORD = 'proof_password';
const FAKE_POSTGRES_DATABASE = 'proof_db';

const buildFakePostgresUrl = ({ host, port }) => {
  const url = new URL(`postgres://${host}:${port}/${FAKE_POSTGRES_DATABASE}`);

  url.username = FAKE_POSTGRES_USER;
  url.password = FAKE_POSTGRES_PASSWORD;

  return url.toString();
};

const baseEnv = () => ({
  HOME: process.env.HOME,
  PATH: process.env.PATH,
});

const runProofRunner = ({ args = [], env = {}, timeout = 15000 } = {}) =>
  new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      {
        cwd: REPO_ROOT,
        env: {
          ...baseEnv(),
          ...env,
        },
        timeout,
      },
      (error, stdout, stderr) => {
        if (error && error.killed) {
          reject(error);
          return;
        }

        resolve({
          code: error && typeof error.code === 'number' ? error.code : 0,
          stdout,
          stderr,
        });
      },
    );
  });

const parseJsonLines = (stdout) =>
  stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

test('missing PG_DATABASE_URL emits structured config-validation error and exits 1', async () => {
  const result = await runProofRunner({ args: ['--validate-config'] });
  const [payload] = parseJsonLines(result.stdout);

  assert.equal(result.code, 1);
  assert.equal(payload.marker, 'ADUANA_LIVE_SURFACE_ERROR');
  assert.equal(payload.phase, 'config-validation');
  assert.match(payload.message, /PG_DATABASE_URL is required/);
});

test('valid local PG_DATABASE_URL emits config-valid marker and exits 0', async () => {
  const result = await runProofRunner({
    args: ['--validate-config'],
    env: {
      PG_DATABASE_URL: buildFakePostgresUrl({ host: '127.0.0.1', port: 5432 }),
    },
  });
  const [payload] = parseJsonLines(result.stdout);

  assert.equal(result.code, 0);
  assert.equal(payload.marker, 'ADUANA_LIVE_SURFACE_CONFIG_VALID');
  assert.equal(
    payload.endpoint,
    'http://127.0.0.1:4000/webhooks/aduana/projection/20202020-1c25-4d02-bf25-6aeccf7ea419',
  );
  assert.equal(payload.workspace, '20202020-1c25-4d02-bf25-6aeccf7ea419');
  assert.equal(payload.noDotenv, true);
  assert.equal(payload.fakeBoundary, true);
});

test('non-local PG_DATABASE_URL is rejected', async () => {
  const result = await runProofRunner({
    args: ['--validate-config'],
    env: {
      PG_DATABASE_URL: buildFakePostgresUrl({
        host: 'db.example.test',
        port: 5432,
      }),
    },
  });
  const [payload] = parseJsonLines(result.stdout);

  assert.equal(result.code, 1);
  assert.equal(payload.marker, 'ADUANA_LIVE_SURFACE_ERROR');
  assert.equal(payload.phase, 'config-validation');
  assert.match(payload.message, /must point to a local Postgres host/);
});

test('dependency failure emits structured live surface error without readiness marker', async () => {
  const result = await runProofRunner({
    env: {
      PG_DATABASE_URL: buildFakePostgresUrl({ host: '127.0.0.1', port: 1 }),
      PG_DATABASE_PRIMARY_TIMEOUT_MS: '250',
      PG_POOL_ALLOW_EXIT_ON_IDLE: 'true',
    },
    timeout: 20000,
  });
  const payloads = parseJsonLines(result.stdout);

  assert.equal(result.code, 1);
  assert.equal(
    payloads.some((payload) => payload.marker === 'ADUANA_LIVE_SURFACE_READY'),
    false,
  );
  assert.equal(payloads.at(-1).marker, 'ADUANA_LIVE_SURFACE_ERROR');
  assert.equal(['bootstrap', 'listen'].includes(payloads.at(-1).phase), true);
});
