# Colmena Aduana Projection Proof

This document records the safe proof path for the ColmenaOS → Twenty Fork Aduana projection receiver and the next operator-coordinated cross-repo proof contract.

## Current proof status

| Proof | Status | Evidence / command |
| --- | --- | --- |
| Receiver integration contract | Passing test gate | `npx nx test:integration:aduana-receiver-proof twenty-server` |
| Receiver negative/resilience contract | Passing test gate | Same focused receiver gate covers tampered signatures, workspace mismatch, malformed JSON, and no-impact assertions |
| No-dotenv operator receiver proof | Passing live proof | `node packages/twenty-server/scripts/start-aduana-receiver-proof.js` emitted `ADUANA_LIVE_SURFACE_READY` and closed cleanly by timeout |
| Live receiver proof harness | Passing test gate | `npx nx test:integration:aduana-live-receiver-proof twenty-server` |
| Cajón 2.3.20 runtime opt-in Kai → receiver proof | Closed as evidence | `colmenaOS` `AUDIT_INDEX.md` records a temporary harness that invoked Kai production delivery code against a live local receiver using fake values only |
| Cajón 2.3.21 durable cross-repo proof path | PASS: operator-coordinated live proof | Twenty runner stayed receiver-only and ColmenaOS/Kai delivered event `aduana.projection.v1:admission.received:FILE-cajon-2321-proof:evidence-cajon-2321-proof` using production projection envelope/transport/delivery functions |

The reliable Twenty Nx targets were added on `twenty-fork/dev` by `61627fbe0c` and are test gates only. They are not governed no-dotenv operator proof evidence because Nx can load workspace env files before process-level guards run. The older generic nested `test:integration --testPathPattern=...` path is not the proof gate.

## Fake proof values

| Value | Purpose |
| --- | --- |
| `20202020-1c25-4d02-bf25-6aeccf7ea419` | Fake workspace ID |
| `fake-aduana-projection-secret` | Fake HMAC shared secret |

## Twenty receiver test gates

Run these from `/home/macala/twenty-fork` on `dev` with fake values only. They are CI/operator test gates, not the governed no-dotenv operator proof path:

```bash
TWENTY_DISABLE_DOTENV=true \
ADUANA_PROJECTION_WORKSPACE_SECRETS='{"20202020-1c25-4d02-bf25-6aeccf7ea419":"fake-aduana-projection-secret"}' \
npx nx test:integration:aduana-receiver-proof twenty-server
```

```bash
TWENTY_DISABLE_DOTENV=true \
ADUANA_PROJECTION_WORKSPACE_SECRETS='{"20202020-1c25-4d02-bf25-6aeccf7ea419":"fake-aduana-projection-secret"}' \
npx nx test:integration:aduana-live-receiver-proof twenty-server
```

These test gates prove receiver behavior:

- exercises `POST /webhooks/aduana/projection/:workspaceId` through the real receiver controller/auth/ingestion path;
- accepts signed valid envelopes and quarantines invalid envelopes;
- rejects corrupt receiver envelopes before acceptance when the signature/body, route workspace, or JSON body is unsafe;
- keeps replay/idempotency behavior controlled;
- keeps fake-value receiver behavior covered without serving as no-dotenv operator evidence.

## Cajón 2.3.23 receiver negative/resilience proof

The focused receiver integration gate is the reconstructible evidence for corrupt-envelope rejection. It uses only the fake workspace and fake HMAC secret documented above.

| Negative case | Expected rejection contract | Observed/covered behavior |
| --- | --- | --- |
| Tampered body signed for different bytes | Unauthorized rejection; do not persist audit or projection impact | `401`, no `aduanaProjectionAudit` row for the nonce, no generic projection mutation |
| Workspace mismatch | Unauthorized rejection before ingestion; do not persist audit or projection impact | `401`, no `aduanaProjectionAudit` row for the nonce, no generic projection mutation |
| Malformed JSON body | Bad-request rejection before ingestion; do not persist audit or projection impact | `400`, no `aduanaProjectionAudit` row for the nonce, no generic projection mutation |

This resilience proof does not add a callback/command channel to ColmenaOS, does not attach ColmenaOS to a Twenty network, and does not prove against a live external receiver. It is a receiver-only Twenty test gate.

Important limit: `test:integration:aduana-live-receiver-proof` proves the live Twenty receiver path, but its envelope is built inside the TypeScript proof. It does **not** invoke ColmenaOS/Kai production delivery code.

## Non-Jest live receiver runner

Use this operator-facing runner for the governed no-dotenv cross-repo proof. It starts only the bounded Aduana projection receiver module with explicit TypeORM configuration, binds to `127.0.0.1:4000`, prepares `core."aduanaProjectionAudit"` with the existing fast instance command, and refuses non-fake proof secrets.

### Config validation

Run from `/home/macala/twenty-fork` on `dev` with an explicit local/test Postgres URL. Do not source `.env` or `.env.test`. This governed no-dotenv proof path intentionally uses direct `node`, not Nx, because Nx can load workspace `.env` files before the runner process starts.

```bash
PG_DATABASE_URL='postgres://<local-test-user>:<local-test-password>@127.0.0.1:<port>/<local-test-db>' \
node packages/twenty-server/scripts/start-aduana-receiver-proof.js --validate-config
```

Expected marker:

```json
{"marker":"ADUANA_LIVE_SURFACE_CONFIG_VALID"}
```

### Start the live receiver

```bash
PG_DATABASE_URL='postgres://<local-test-user>:<local-test-password>@127.0.0.1:<port>/<local-test-db>' \
node packages/twenty-server/scripts/start-aduana-receiver-proof.js
```

The runner prints readiness only after `await app.listen(4000, '127.0.0.1')` succeeds:

```json
{
  "marker": "ADUANA_LIVE_SURFACE_READY",
  "endpoint": "http://127.0.0.1:4000/webhooks/aduana/projection/20202020-1c25-4d02-bf25-6aeccf7ea419",
  "workspace": "20202020-1c25-4d02-bf25-6aeccf7ea419",
  "noDotenv": true,
  "fakeBoundary": true
}
```

On failure it prints structured JSON with `marker: "ADUANA_LIVE_SURFACE_ERROR"`, a `phase`, and a sanitized message, then exits nonzero. `SIGINT`/`SIGTERM` close the Nest app cleanly.

After `ADUANA_LIVE_SURFACE_READY`, run the ColmenaOS/Kai proof from `/home/macala/colmenaOS`:

```bash
COLMENA_TWENTY_PROOF_ENDPOINT='http://127.0.0.1:4000/webhooks/aduana/projection/20202020-1c25-4d02-bf25-6aeccf7ea419' \
COLMENA_TWENTY_PROOF_WORKSPACE_ID='20202020-1c25-4d02-bf25-6aeccf7ea419' \
COLMENA_TWENTY_PROOF_SECRET='fake-aduana-projection-secret' \
python scripts/prove_twenty_projection_delivery.py
```

## Cajón 2.3.21 operator-coordinated proof contract

The next slice should prove one opt-in ColmenaOS/Kai projection against a live Twenty receiver without changing branch topology or weakening boundaries.

### Required setup

| Area | Contract |
| --- | --- |
| Twenty repo | `/home/macala/twenty-fork` on `dev`; keep `main` as the clean Twenty base |
| ColmenaOS repo | `/home/macala/colmenaOS` on `dev`; use it only as the Kai production-code side of the proof |
| Secrets | Fake workspace and fake HMAC secret only |
| Dotenv | Do not read or modify `.env` / `.env.test`; keep explicit no-dotenv guards where supported |
| Networks | Do not attach Kai to `twenty-dev_default`; any proof network must be explicit and bounded |
| Authority | No direct DB write from Kai into Twenty; no command-channel or callback from Twenty to ColmenaOS |
| Local files | Keep `.atl/` untracked unless a separate governance decision says otherwise |

### Operator steps

1. In `twenty-fork`, run the receiver gate and the live receiver gate with the fake values shown above as test gates only.
2. Validate and start the direct non-Nx `node packages/twenty-server/scripts/start-aduana-receiver-proof.js` runner with an explicit local/test `PG_DATABASE_URL`; this is the only governed no-dotenv operator proof path.
3. In `colmenaOS`, run the selected Cajón 2.3.21 Kai proof command so it invokes production delivery code (`build_projection_envelope()`, `build_twenty_fork_http_transport()`, and `deliver_projection_to_twenty_fork()`) with explicit endpoint, workspace ID, secret, timestamp/nonce inputs, and no dotenv dependency.
4. Capture evidence in the repo that owns the proof result: command, branch, commit, fake values used, PASS/FAIL, receiver response/event ID, and any cleanup performed.

### Expected evidence

- `git status --short --branch` for both repos before/after the proof.
- Twenty receiver test gates and PASS results.
- ColmenaOS/Kai command proving production delivery code was invoked.
- Receiver response showing a delivered/accepted projection or a precise failure.
- Explicit statement that no `.env` / `.env.test`, real secrets, direct DB write, callback channel, `twenty-dev_default` attachment, or `dev` → `main` promotion occurred.

### No-goals

- Do not promote `twenty-fork/dev` to `main`.
- Do not turn Twenty into a command source for ColmenaOS.
- Do not add real workspace secrets or production tenant configuration.
- Do not make Kai join Twenty's default Docker network.
- Do not broaden this into a full workflow automation slice before the operator contract is stable.

## Future automation options

| Option | Tradeoff |
| --- | --- |
| Cross-repo harness | Stronger single-command reproducibility and easier CI gating, but higher coupling between repos and more care needed to avoid path, dependency, and secret leakage. |
| Manual `workflow_dispatch` | Clear human opt-in and lower coupling, but evidence correlation across repos is more manual and easier to drift. |

Start with the operator-coordinated contract above. Automate only after the exact command surface and evidence expectations are stable.

## 2026-07-10 operator attempt result

- `npx nx test:integration:aduana-receiver-proof twenty-server` passed on rerun with the fake workspace/secret and `TWENTY_DISABLE_DOTENV=true`.
- `npx nx test:integration:aduana-live-receiver-proof twenty-server` passed with the same fake/no-dotenv boundary.
- No persistent listener remained on `127.0.0.1:4000` after the Jest-managed live receiver gate completed.
- A bounded direct-Jest keepalive attempt using a temporary `/tmp/opencode` setup hook failed during database startup with `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` before the ColmenaOS proof command could run.
- Result: the external ColmenaOS proof command was not executed. Add a safe documented keepalive/runner surface before retrying the cross-repo live proof.

## 2026-07-10 live cross-repo proof PASS

Starting state:

- `/home/macala/twenty-fork`: `dev`, HEAD `63841bbd701ac580b1a1ca2ab1bf23dd6e663d8c`, only `.atl/` untracked.
- `/home/macala/colmenaOS`: `dev...origin/dev`, HEAD `7ed50d7d9ae4658bb70fda6526907bc6801563d9`.

Twenty runner command:

```bash
PG_DATABASE_URL='<explicit-local-test-postgres-url>' ADUANA_RECEIVER_PROOF_TIMEOUT_MS=60000 node packages/twenty-server/scripts/start-aduana-receiver-proof.js
```

Result: exit code 0. The actual run used the public local/test Postgres URL template from `.env.example` as an explicit `PG_DATABASE_URL` value; it did not source `.env` or `.env.test`. The runner emitted `ADUANA_LIVE_SURFACE_READY` for endpoint `http://127.0.0.1:4000/webhooks/aduana/projection/20202020-1c25-4d02-bf25-6aeccf7ea419`, `noDotenv=true`, `fakeBoundary=true`, bind `127.0.0.1:4000`, bounded module `AduanaProjectionReceiverProofModule`, and then `ADUANA_LIVE_SURFACE_CLOSED` by timeout.

ColmenaOS proof command:

```bash
COLMENA_TWENTY_PROOF_ENDPOINT='http://127.0.0.1:4000/webhooks/aduana/projection/20202020-1c25-4d02-bf25-6aeccf7ea419' COLMENA_TWENTY_PROOF_WORKSPACE_ID='20202020-1c25-4d02-bf25-6aeccf7ea419' COLMENA_TWENTY_PROOF_SECRET='fake-aduana-projection-secret' PYTHONDONTWRITEBYTECODE=1 PYTHONPATH='/tmp/opencode/colmenaos-kai-deps:/home/macala/colmenaOS' python3 scripts/prove_twenty_projection_delivery.py
```

Result: exit code 0, output status `delivered`, event ID `aduana.projection.v1:admission.received:FILE-cajon-2321-proof:evidence-cajon-2321-proof`.

Boundaries preserved: no `.env` / `.env.test` read or modified; fake workspace/secret only; no real secrets; Kai invoked production projection envelope/transport/delivery functions; Kai did not write directly to Twenty DB; Twenty remained receiver only with no callback/command-channel to ColmenaOS; Kai was not attached to `twenty-dev_default`; runner closed cleanly by timeout.

Conclusion: Cajón 2.3.21 live proof is PASS. This is operator-coordinated live evidence, not CI automation.
