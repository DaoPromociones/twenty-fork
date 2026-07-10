#!/usr/bin/env node

process.env.TWENTY_DISABLE_DOTENV = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.TS_NODE_PROJECT =
  process.env.TS_NODE_PROJECT || `${__dirname}/../tsconfig.json`;
process.env.ADUANA_PROJECTION_WORKSPACE_SECRETS =
  process.env.ADUANA_PROJECTION_WORKSPACE_SECRETS ||
  JSON.stringify({
    '20202020-1c25-4d02-bf25-6aeccf7ea419':
      'fake-aduana-projection-secret',
  });

require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
require('../src/aduana-projection-receiver-proof/aduana-projection-receiver-proof');
