# T001 Repo Skeleton + Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the full Metis repo structure — Rust workspace, Python project, SvelteKit frontend, root config files — so all three toolchains build cleanly from empty stubs.

**Architecture:** Three independent toolchain stacks (Rust, Python, SvelteKit) scaffolded sequentially. No cross-stack dependencies at this stage. The directory skeleton and root files land first, then each stack is bootstrapped and smoke-tested before committing.

**Tech Stack:** Rust 1.94 (cargo), Python 3.12 (uv), Node 20 / pnpm 11 (SvelteKit 2 + Svelte 5 + Tailwind v4 + shadcn-svelte + TanStack Table Core)

---

## File Map

| File | Created by | Purpose |
|---|---|---|
| `.gitignore` | Task 1 | Excludes target/, .venv/, data/, node_modules/, build artifacts |
| `LICENSE` | Task 1 | Apache-2.0 full text |
| `README.md` | Task 1 | One-paragraph project description |
| `sql/migrations/.gitkeep` | Task 1 | Keeps empty dirs in git |
| `sql/views/.gitkeep` | Task 1 | ditto |
| `notebooks/.gitkeep` | Task 1 | ditto |
| `docs/adr/.gitkeep` | Task 1 | ditto |
| `.github/workflows/.gitkeep` | Task 1 | ditto |
| `Cargo.toml` | Task 2 | Workspace root: member list, shared deps, lint config |
| `crates/metis-{core,db,compute,api}/Cargo.toml` | Task 2 | Library crate manifests |
| `crates/metis-{core,db,compute,api}/src/lib.rs` | Task 2 | Empty library stubs |
| `crates/metis-{tauri,cli}/Cargo.toml` | Task 2 | Binary crate manifests |
| `crates/metis-{tauri,cli}/src/main.rs` | Task 2 | Minimal `fn main() {}` stubs |
| `python/pyproject.toml` | Task 3 | uv-managed project: deps, ruff, mypy config |
| `python/.python-version` | Task 3 | Pins Python 3.12 |
| `python/ingest/__init__.py` | Task 3 | Empty module marker |
| `python/ingest/base.py` | Task 3 | Docstring stub for Adapter protocol |
| `python/ml/__init__.py` | Task 3 | Empty module marker |
| `python/cv/__init__.py` | Task 3 | Empty module marker |
| `frontend/` (directory) | Task 4 | SvelteKit project via `pnpm dlx sv create` |
| `frontend/svelte.config.js` | Task 4 | Overwritten: adapter-static, no SSR |
| `frontend/vite.config.ts` | Task 4 | Overwritten: Tailwind v4 vite plugin + sveltekit |
| `frontend/src/app.css` | Task 4 | Tailwind v4 import + shadcn CSS variables |
| `frontend/src/routes/+layout.svelte` | Task 4 | Root layout that imports app.css |
| `frontend/src/lib/utils.ts` | Task 4 | `cn()` helper (clsx + tailwind-merge) |
| `frontend/components.json` | Task 4 | shadcn-svelte config |

---

## Task 1: Directories, .gitignore, LICENSE, README

**Files:**
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`
- Create: `sql/migrations/.gitkeep`, `sql/views/.gitkeep`, `notebooks/.gitkeep`, `docs/adr/.gitkeep`, `.github/workflows/.gitkeep`

- [ ] **Step 1: Create empty-dir placeholders**

```bash
mkdir -p sql/migrations sql/views notebooks docs/adr .github/workflows
touch sql/migrations/.gitkeep sql/views/.gitkeep notebooks/.gitkeep docs/adr/.gitkeep .github/workflows/.gitkeep
```

Expected: no output, all 5 files exist.

- [ ] **Step 2: Write `.gitignore`**

Create `/home/yhabie/project/metis/.gitignore`:

```gitignore
# Rust
/target/
# Cargo.lock is committed (workspace has binaries)

# Python
.venv/
__pycache__/
*.pyc
.mypy_cache/
.ruff_cache/

# Data — never committed
/data/

# Node / frontend
node_modules/
.svelte-kit/
/frontend/build/
/frontend/.svelte-kit/

# Tauri build artifacts
/src-tauri/target/

# DuckDB
*.duckdb
*.duckdb.wal

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Write `LICENSE`**

Create `/home/yhabie/project/metis/LICENSE` with the full Apache-2.0 text:

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or exemplary damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2026 Metis Contributors

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

- [ ] **Step 4: Write `README.md`**

Create `/home/yhabie/project/metis/README.md`:

```markdown
# Metis

Metis is a local-first NBA statistics desktop app that ingests data from multiple public sources (stats.nba.com, Basketball-Reference, pbpstats), stores it in an embedded DuckDB + Parquet store, computes traditional and advanced statistics, and serves a Tauri + SvelteKit dashboard for filtering, sorting, and comparing players and teams across any era.

See [CLAUDE.md](CLAUDE.md) for architecture, tech-stack decisions, and contribution conventions.
```

- [ ] **Step 5: Verify nothing in `data/` is tracked**

```bash
git -C /home/yhabie/project/metis ls-files data/
```

Expected: no output (empty).

- [ ] **Step 6: Commit Task 1**

```bash
cd /home/yhabie/project/metis
git add .gitignore LICENSE README.md sql/ notebooks/ docs/adr/ .github/
git commit -m "chore: repo skeleton — dirs, .gitignore, LICENSE, README"
```

---

## Task 2: Rust Workspace

**Files:**
- Create: `Cargo.toml` (workspace root)
- Create: `crates/metis-core/Cargo.toml` + `src/lib.rs`
- Create: `crates/metis-db/Cargo.toml` + `src/lib.rs`
- Create: `crates/metis-compute/Cargo.toml` + `src/lib.rs`
- Create: `crates/metis-api/Cargo.toml` + `src/lib.rs`
- Create: `crates/metis-tauri/Cargo.toml` + `src/main.rs`
- Create: `crates/metis-cli/Cargo.toml` + `src/main.rs`

- [ ] **Step 1: Create crate directories**

```bash
mkdir -p crates/metis-core/src \
         crates/metis-db/src \
         crates/metis-compute/src \
         crates/metis-api/src \
         crates/metis-tauri/src \
         crates/metis-cli/src
```

- [ ] **Step 2: Write workspace root `Cargo.toml`**

Create `/home/yhabie/project/metis/Cargo.toml`:

```toml
[workspace]
members = ["crates/*"]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"
license = "Apache-2.0"

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
thiserror = "2"
tokio = { version = "1", features = ["full"] }
anyhow = "1"

[workspace.lints.clippy]
all = { level = "deny", priority = -1 }
pedantic = { level = "warn", priority = -1 }

[workspace.lints.rust]
unused_imports = "deny"
unused_variables = "deny"
```

- [ ] **Step 3: Write library crate manifests**

Create `/home/yhabie/project/metis/crates/metis-core/Cargo.toml`:

```toml
[package]
name = "metis-core"
version.workspace = true
edition.workspace = true
license.workspace = true

[lints]
workspace = true
```

Create `/home/yhabie/project/metis/crates/metis-db/Cargo.toml`:

```toml
[package]
name = "metis-db"
version.workspace = true
edition.workspace = true
license.workspace = true

[lints]
workspace = true
```

Create `/home/yhabie/project/metis/crates/metis-compute/Cargo.toml`:

```toml
[package]
name = "metis-compute"
version.workspace = true
edition.workspace = true
license.workspace = true

[lints]
workspace = true
```

Create `/home/yhabie/project/metis/crates/metis-api/Cargo.toml`:

```toml
[package]
name = "metis-api"
version.workspace = true
edition.workspace = true
license.workspace = true

[lints]
workspace = true
```

- [ ] **Step 4: Write library stubs**

Create four empty files (zero bytes, no content at all):

```bash
touch crates/metis-core/src/lib.rs \
      crates/metis-db/src/lib.rs \
      crates/metis-compute/src/lib.rs \
      crates/metis-api/src/lib.rs
```

- [ ] **Step 5: Write binary crate manifests**

Create `/home/yhabie/project/metis/crates/metis-tauri/Cargo.toml`:

```toml
[package]
name = "metis-tauri"
version.workspace = true
edition.workspace = true
license.workspace = true

[[bin]]
name = "metis-tauri"
path = "src/main.rs"

[lints]
workspace = true
```

Create `/home/yhabie/project/metis/crates/metis-cli/Cargo.toml`:

```toml
[package]
name = "metis-cli"
version.workspace = true
edition.workspace = true
license.workspace = true

[[bin]]
name = "metis-cli"
path = "src/main.rs"

[lints]
workspace = true
```

- [ ] **Step 6: Write binary stubs**

Create `/home/yhabie/project/metis/crates/metis-tauri/src/main.rs`:

```rust
fn main() {}
```

Create `/home/yhabie/project/metis/crates/metis-cli/src/main.rs`:

```rust
fn main() {}
```

- [ ] **Step 7: Build the workspace**

```bash
cd /home/yhabie/project/metis && cargo build
```

Expected: `Compiling metis-core ...` through `Compiling metis-cli ...`, ending with `Finished dev [unoptimized + debuginfo] target(s)`. Zero errors, zero warnings.

If you see a warning about unused items, check that `lib.rs` files are truly empty (no placeholder functions). If clippy fires on `main() {}`, ensure `[lints] workspace = true` is present in each Cargo.toml.

- [ ] **Step 8: Commit Task 2**

```bash
cd /home/yhabie/project/metis
git add Cargo.toml Cargo.lock crates/
git commit -m "chore: rust workspace — 6 empty crates, shared lint config"
```

---

## Task 3: Python Project

**Files:**
- Create: `python/pyproject.toml`
- Create: `python/.python-version`
- Create: `python/ingest/__init__.py`
- Create: `python/ingest/base.py`
- Create: `python/ml/__init__.py`
- Create: `python/cv/__init__.py`

- [ ] **Step 1: Create Python directories**

```bash
mkdir -p python/ingest python/ml python/cv
```

- [ ] **Step 2: Write `python/.python-version`**

Create `/home/yhabie/project/metis/python/.python-version`:

```
3.12
```

- [ ] **Step 3: Write `python/pyproject.toml`**

Create `/home/yhabie/project/metis/python/pyproject.toml`:

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

- [ ] **Step 4: Write module stubs**

Create `/home/yhabie/project/metis/python/ingest/__init__.py` — empty file (zero bytes).

Create `/home/yhabie/project/metis/python/ingest/base.py`:

```python
"""Adapter protocol — defined in T020."""
```

Create `/home/yhabie/project/metis/python/ml/__init__.py` — empty file.

Create `/home/yhabie/project/metis/python/cv/__init__.py` — empty file.

- [ ] **Step 5: Run `uv sync`**

```bash
cd /home/yhabie/project/metis/python && uv sync
```

Expected: uv creates `.venv/`, resolves and installs `pyarrow`, `nba_api`, `requests` and their transitive deps. Final line: `Resolved N packages in ...s`.

If uv reports a Python version error, run `uv python install 3.12` first.

- [ ] **Step 6: Run `ruff check`**

```bash
cd /home/yhabie/project/metis/python && uv run ruff check
```

Expected: `All checks passed!` (no output or just the success line).

- [ ] **Step 7: Commit Task 3**

```bash
cd /home/yhabie/project/metis
git add python/
git commit -m "chore: python project — uv workspace, module stubs, ruff+mypy config"
```

Note: `python/.venv/` is covered by `.gitignore` — confirm `git status` shows no `.venv` files staged.

---

## Task 4: SvelteKit Frontend

**Files:**
- Create: `frontend/` via `pnpm dlx sv create`
- Overwrite: `frontend/svelte.config.js`
- Overwrite: `frontend/vite.config.ts`
- Create: `frontend/src/app.css`
- Create: `frontend/src/routes/+layout.svelte`
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/components.json`

- [ ] **Step 1: Scaffold SvelteKit project**

Run from `/home/yhabie/project/metis`:

```bash
pnpm dlx sv create frontend --template minimal --types ts --no-install
```

If the CLI prompts for additional options (add-ons, git, etc.), respond:
- Add-ons: **none** / skip (we add tailwind manually)
- Initialize git repo: **no** (already in one)
- Install dependencies: **no**

Expected: `frontend/` directory created containing `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/routes/+page.svelte`.

- [ ] **Step 2: Install core deps**

```bash
cd /home/yhabie/project/metis/frontend && pnpm install
```

Expected: `node_modules/` populated, `pnpm-lock.yaml` created/updated.

- [ ] **Step 3: Replace adapter-auto with adapter-static**

```bash
cd /home/yhabie/project/metis/frontend
pnpm remove @sveltejs/adapter-auto
pnpm add -D @sveltejs/adapter-static
```

Expected: `@sveltejs/adapter-auto` removed from `package.json`, `@sveltejs/adapter-static` added.

- [ ] **Step 4: Add Tailwind v4**

```bash
cd /home/yhabie/project/metis/frontend
pnpm add -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 5: Add shadcn-svelte packages**

```bash
cd /home/yhabie/project/metis/frontend
pnpm add bits-ui
pnpm add -D clsx tailwind-merge
```

- [ ] **Step 6: Add TanStack Table Core**

```bash
cd /home/yhabie/project/metis/frontend
pnpm add @tanstack/table-core
```

- [ ] **Step 7: Overwrite `frontend/svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: null,
    }),
  },
};

export default config;
```

- [ ] **Step 8: Overwrite `frontend/vite.config.ts`**

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
  ],
});
```

- [ ] **Step 9: Write `frontend/src/app.css`**

If the file doesn't exist, create it. If it exists, overwrite with:

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
}
```

- [ ] **Step 10: Create `frontend/src/routes/+layout.svelte`**

```svelte
<script>
  import '../app.css';
</script>

<slot />
```

- [ ] **Step 11: Create `frontend/src/lib/utils.ts`**

First create the directory if it doesn't exist:

```bash
mkdir -p /home/yhabie/project/metis/frontend/src/lib
```

Then write `frontend/src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 12: Write `frontend/components.json`**

```json
{
  "$schema": "https://shadcn-svelte.com/schema.json",
  "style": "new-york",
  "tailwind": {
    "css": "src/app.css",
    "baseColor": "zinc"
  },
  "aliases": {
    "components": "$lib/components",
    "utils": "$lib/utils",
    "ui": "$lib/components/ui",
    "hooks": "$lib/hooks"
  }
}
```

- [ ] **Step 13: Run frontend build**

```bash
cd /home/yhabie/project/metis/frontend && pnpm run build
```

Expected: `.svelte-kit/` and `build/` directories created, ending with output like:
```
✓ built in Xs
```

If the build fails with a TypeScript error about `+layout.svelte` and `<slot />` (Svelte 5 uses `{@render children()}` instead of `<slot />`), update `+layout.svelte`:

```svelte
<script>
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

If the build fails because `@tailwindcss/vite` is not found, verify Step 4 ran and re-run `pnpm install`.

- [ ] **Step 14: Commit Task 4**

```bash
cd /home/yhabie/project/metis
git add frontend/
git commit -m "chore: sveltekit frontend — adapter-static, tailwind v4, shadcn-svelte, tanstack table"
```

---

## Task 5: Acceptance Verification

- [ ] **Step 1: Verify `cargo build`**

```bash
cd /home/yhabie/project/metis && cargo build
```

Expected: `Finished dev [unoptimized + debuginfo] target(s)` with zero warnings and zero errors.

- [ ] **Step 2: Verify Python toolchain**

```bash
cd /home/yhabie/project/metis/python && uv sync && uv run ruff check
```

Expected: sync succeeds, `ruff check` prints nothing (all checks passed).

- [ ] **Step 3: Verify frontend build**

```bash
cd /home/yhabie/project/metis/frontend && pnpm run build
```

Expected: build succeeds, `build/` directory created.

- [ ] **Step 4: Verify `data/` is not tracked**

```bash
cd /home/yhabie/project/metis && git ls-files data/
```

Expected: no output.

- [ ] **Step 5: Final commit (if any fixes were needed)**

If any files were modified during verification fixes, commit them:

```bash
cd /home/yhabie/project/metis
git add -p
git commit -m "fix: t001 acceptance — <describe what was fixed>"
```

If no changes, skip this step.

- [ ] **Step 6: Confirm all acceptance criteria are met**

Checklist from Plan.md T001:
- [ ] `cargo build` succeeded (all 6 empty crates, zero warnings)
- [ ] `uv sync && ruff check` succeeded
- [ ] `pnpm run build` succeeded
- [ ] `git ls-files data/` returned nothing
