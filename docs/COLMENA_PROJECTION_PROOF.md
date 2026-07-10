# Colmena Aduana Projection Proof

This document records the safe proof path for the ColmenaOS → Twenty Fork Aduana projection receiver and the next operator-coordinated cross-repo proof contract.

## Current proof status

| Proof | Status | Evidence / command |
| --- | --- | --- |
| Receiver integration contract | Passing | `npx nx test:integration:aduana-receiver-proof twenty-server` |
| No-dotenv receiver proof | Passing | Same target with `TWENTY_DISABLE_DOTENV=true` and fake workspace secret |
| Live receiver proof harness | Passing | `npx nx test:integration:aduana-live-receiver-proof twenty-server` |
| Cajón 2.3.20 runtime opt-in Kai → receiver proof | Closed as evidence | `colmenaOS` `AUDIT_INDEX.md` records a temporary harness that invoked Kai production delivery code against a live local receiver using fake values only |
| Cajón 2.3.21 durable cross-repo proof path | Blocked for live external command | Receiver gates pass, but the 2026-07-10 operator attempt found no safe documented keepalive/runner surface for the external ColmenaOS command without dotenv or broad stack startup |

The reliable Twenty proof targets were added on `twenty-fork/dev` by `61627fbe0c` and are the supported operator/CI entrypoints for this proof family. The older generic nested `test:integration --testPathPattern=...` path is not the proof gate.

## Fake proof values

| Value | Purpose |
| --- | --- |
| `20202020-1c25-4d02-bf25-6aeccf7ea419` | Fake workspace ID |
| `fake-aduana-projection-secret` | Fake HMAC shared secret |

## Twenty receiver proof commands

Run these from `/home/macala/twenty-fork` on `dev` with fake values only:

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

These prove the Twenty receiver path:

- exercises `POST /webhooks/aduana/projection/:workspaceId` through the real receiver controller/auth/ingestion path;
- accepts signed valid envelopes and quarantines invalid envelopes;
- keeps replay/idempotency behavior controlled;
- disables `.env` / `.env.test` loading through `TWENTY_DISABLE_DOTENV=true`.

Important limit: `test:integration:aduana-live-receiver-proof` proves the live Twenty receiver path, but its envelope is built inside the TypeScript proof. It does **not** invoke ColmenaOS/Kai production delivery code.

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

1. In `twenty-fork`, run the receiver gate and the live receiver gate with the fake values shown above.
2. Start or reuse only the bounded live receiver surface needed for the proof; keep Postgres/Redis local and do not load dotenv files.
3. In `colmenaOS`, run the selected Cajón 2.3.21 Kai proof command so it invokes production delivery code (`build_projection_envelope()`, `build_twenty_fork_http_transport()`, and `deliver_projection_to_twenty_fork()`) with explicit endpoint, workspace ID, secret, timestamp/nonce inputs, and no dotenv dependency.
4. Capture evidence in the repo that owns the proof result: command, branch, commit, fake values used, PASS/FAIL, receiver response/event ID, and any cleanup performed.

### Expected evidence

- `git status --short --branch` for both repos before/after the proof.
- Twenty receiver proof commands and PASS results.
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
