# Colmena Aduana Projection Proof

This document records the safe proof path for the ColmenaOS → Twenty Fork Aduana projection receiver.

## Current proof status

| Proof | Status | Command |
| --- | --- | --- |
| Receiver integration contract | Passing | `npx nx test:integration twenty-server --testPathPattern=aduana-projection` |
| No-dotenv receiver proof | Passing | See command below |
| Live Kai → receiver proof | Pending | Requires a safe live receiver process and explicit fake config |

## No-dotenv receiver proof

Use fake values only:

```bash
TWENTY_DISABLE_DOTENV=true \
ADUANA_PROJECTION_WORKSPACE_SECRETS='{"20202020-1c25-4d02-bf25-6aeccf7ea419":"fake-aduana-projection-secret"}' \
npx nx test:integration twenty-server --testPathPattern=aduana-projection-receiver --verbose
```

This proves:

- the real receiver HTTP path is exercised: `POST /webhooks/aduana/projection/:workspaceId`;
- signed valid envelopes are accepted;
- invalid envelopes are quarantined;
- replay/idempotency behavior remains controlled;
- `.env` / `.env.test` loading is disabled by `TWENTY_DISABLE_DOTENV=true`.

## What this does not prove

- It does not prove a live ColmenaOS/Kai container can reach the receiver.
- It does not create or validate `colmena-twenty-projection-net`.
- It does not use real secrets or production workspace configuration.
- It does not prove the broader no-dotenv `aduana-projection` suite; metadata and mutation-denial no-dotenv seed setup is separate hardening.

## Live proof prerequisites

Before attempting a live Kai → receiver proof:

1. Use fake workspace and fake secret only.
2. Keep `TWENTY_DISABLE_DOTENV=true`.
3. Do not read `.env` or `.env.test`.
4. Keep Postgres and Redis bound to localhost only.
5. Do not attach Kai to `twenty-dev_default`.
6. Use `colmena-twenty-projection-net` only through explicit compose/proof setup.
7. Do not add command/callback routes or direct DB writes from ColmenaOS/Kai.

## Fake proof values

| Value | Purpose |
| --- | --- |
| `20202020-1c25-4d02-bf25-6aeccf7ea419` | Fake workspace ID |
| `fake-aduana-projection-secret` | Fake HMAC shared secret |

## Next step

Create a live receiver process/profile that uses the no-dotenv guard and fake values, then send one opt-in projection from ColmenaOS/Kai using the production delivery code.
