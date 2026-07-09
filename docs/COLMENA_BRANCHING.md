# Colmena Branching Model for Twenty Fork

This fork keeps Twenty's clean base separate from ColmenaOS integration work.

## Branch roles

| Branch | Role | Rule |
| --- | --- | --- |
| `main` | Clean Twenty base | Keep easy to sync with upstream Twenty. Do not use for daily ColmenaOS work. |
| `dev` | ColmenaOS-Twenty sanctuary | Holds validated integration work after CI/CD and review. |
| `feat/*` | Work/lab branches | Use for active slices before merging into `dev`. |

## Default flow

```text
upstream Twenty
  -> main
  -> dev
  -> feat/*
```

Changes return through:

```text
feat/* -> dev
```

Do not merge `dev -> main` by default. That would turn `main` into the ColmenaOS-Twenty product branch instead of a clean Twenty base.

## Main branch rule

`main` changes role only by explicit maintainer decision. If that decision is made, record it before merging `dev` into `main`.

## Current Colmena convention

- Keep `main` as the clean Twenty sync point.
- Use `dev` as the stable ColmenaOS-Twenty integration line.
- Use feature branches such as `feat/colmena-aduana-projection` for active projection/receiver work.
- Do not commit generated local agent metadata such as `.atl/` unless a separate governance decision says so.
