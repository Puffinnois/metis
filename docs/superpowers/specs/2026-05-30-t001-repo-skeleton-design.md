# T001 — Repo Skeleton + Tooling Design

**Date:** 2026-05-30  
**Plan task:** T001 ⚙️  
**Status:** Approved

---

## Goal

Bootstrap the full Metis repository structure from scratch: Rust workspace, Python project, SvelteKit frontend, `.gitignore`, `LICENSE`, and `README.md`. Produces a repo where all three toolchains build cleanly with empty stubs, ready for Phase 0 task T002 (pre-commit + CI).

---

## Directory structure

Matches CLAUDE.md "Repository layout" exactly:

```
metis/
├── crates/
│   ├── metis-core/        # lib crate
│   ├── metis-db/          # lib crate
│   ├── metis-compute/     # lib crate
│   ├── metis-api/         # lib crate
│   ├── metis-tauri/       # bin crate
│   └── metis-cli/         # bin crate
├── python/
│   ├── pyproject.toml
│   ├── ingest/
│   │   ├── __init__.py
│   │   └── base.py        # empty stub (Adapter protocol placeholder)
│   ├── ml/
│   │   └── __init__.py
│   └── cv/
│       └── __init__.py
├── frontend/              # SvelteKit project (sv create, Option A)
├── sql/
│   ├── migrations/        # empty, .gitkeep
│   └── views/             # empty, .gitkeep
├── data/                  # gitignored — never committed
├── notebooks/             # empty, .gitkeep
├── docs/
│   ├── adr/               # empty, .gitkeep
│   └── superpowers/specs/ # this file
├── .github/
│   └── workflows/         # empty for now (T002 adds ci.yml)
├── .gitignore
├── Cargo.toml             # workspace root
├── LICENSE                # Apache-2.0
└── README.md
```

`data/` is never committed — only appears in `.gitignore`.

---

## Rust workspace

### Root `Cargo.toml`

- `[workspace]` with `members = ["crates/*"]` and `resolver = "2"`
- `[workspace.dependencies]` pins shared deps:
  - `serde = { version = "1", features = ["derive"] }`
  - `thiserror = "2"`
  - `tokio = { version = "1", features = ["full"] }`
  - `anyhow = "1"`
- `[workspace.lints.clippy]` sets `all = "deny"` and `pedantic = "warn"`
- `[workspace.lints.rust]` sets `unused_imports = "deny"`, `unused_variables = "deny"`

### Member crates

Each crate's `Cargo.toml` inherits via `workspace = true` for any shared dep it needs. Empty stubs only:

| Crate | Type | Initial content |
|---|---|---|
| `metis-core` | lib | `pub fn placeholder() {}` in `lib.rs` |
| `metis-db` | lib | same |
| `metis-compute` | lib | same |
| `metis-api` | lib | same |
| `metis-tauri` | bin | `fn main() {}` in `main.rs` |
| `metis-cli` | bin | `fn main() {}` in `main.rs` |

No crate dependencies on each other yet — that's wired in later tasks when real code exists.

---

## Python project

### `python/pyproject.toml`

Managed by `uv`. Key fields:

```toml
[project]
name = "metis-ingest"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "pyarrow>=15.0",
    "nba_api>=1.4",
    "requests>=2.32",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]

[tool.mypy]
strict = true
python_version = "3.12"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### `python/.python-version`

```
3.12
```

### Module stubs

- `python/ingest/__init__.py` — empty
- `python/ingest/base.py` — single-line docstring: `"""Adapter protocol (defined in T020)."""`
- `python/ml/__init__.py` — empty
- `python/cv/__init__.py` — empty

---

## Frontend

### Scaffold (Option A)

1. `sv create frontend` — TypeScript, no routing framework yet, Tailwind plugin enabled
2. `cd frontend && pnpm dlx shadcn-svelte@latest init`
3. `pnpm add @tanstack/table-core`

### Key config

**`frontend/svelte.config.js`**
```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: null }),
  },
};
```

No SSR. `fallback: null` because Tauri serves files directly — no SPA routing fallback needed at the static-adapter level.

### No routes yet

No `src/routes/` content beyond the default stub. Pages are added in T071+.

---

## `.gitignore`

Covers all three toolchains:

```
# Rust
/target/
Cargo.lock   # kept for binary crates — see note below

# Python
.venv/
__pycache__/
*.pyc
.mypy_cache/
.ruff_cache/

# Data (never committed)
/data/

# Node / frontend
node_modules/
.svelte-kit/
/frontend/build/
/frontend/.svelte-kit/

# Tauri build artifacts
/src-tauri/target/

# DuckDB files
*.duckdb
*.duckdb.wal

# OS
.DS_Store
Thumbs.db
```

> Note on `Cargo.lock`: CLAUDE.md doesn't specify. Convention for Rust workspaces that contain binaries: commit `Cargo.lock` for reproducible builds. Library-only workspaces typically gitignore it. Since this workspace has two binaries (`metis-tauri`, `metis-cli`), `Cargo.lock` is committed.

---

## LICENSE

Standard Apache-2.0 full text. Copyright line: `Copyright 2026 Metis Contributors`.

---

## README.md

One paragraph describing Metis as a local-first NBA statistics desktop app built on Rust + DuckDB + Tauri + SvelteKit. Link to `CLAUDE.md` for architecture details.

---

## Acceptance criteria (from Plan.md)

- [ ] `cargo build` succeeds (all 6 empty crates compile, zero warnings)
- [ ] `cd python && uv sync && ruff check` succeeds
- [ ] `cd frontend && pnpm run build` succeeds
- [ ] `git ls-files data/` returns nothing (data/ not tracked)
