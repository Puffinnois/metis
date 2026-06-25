<script lang="ts">
  import { onMount } from "svelte";
  import { listViews, createView, updateView, deleteView, type UserViewDto } from "./api.js";

  interface Props {
    entityType: string;
    /** Called when user loads a view — passes the parsed filter/sort/columns blobs. */
    onload: (filters: Record<string, string>, sortConfig: Record<string, string> | null, columns: Record<string, string> | null) => void;
    /** Returns the current state to serialize when saving. */
    getState: () => {
      filters: Record<string, string>;
      sortConfig: Record<string, string> | null;
      columns: Record<string, string> | null;
    };
  }

  let { entityType, onload, getState }: Props = $props();

  let views = $state<UserViewDto[]>([]);
  let open = $state(false);
  let saving = $state(false);
  let saveName = $state("");
  let saveError = $state<string | null>(null);
  let showSaveForm = $state(false);
  let saveInput = $state<HTMLInputElement | undefined>(undefined);

  $effect(() => {
    if (showSaveForm && saveInput) saveInput.focus();
  });

  onMount(async () => {
    await reload();
  });

  async function reload() {
    views = await listViews(entityType);
  }

  function load(view: UserViewDto) {
    try {
      const filters = JSON.parse(view.filters) as Record<string, string>;
      const sortConfig = view.sort_config ? (JSON.parse(view.sort_config) as Record<string, string>) : null;
      const columns = view.columns ? (JSON.parse(view.columns) as Record<string, string>) : null;
      onload(filters, sortConfig, columns);
      open = false;
    } catch {
      // malformed JSON in stored view — ignore
    }
  }

  async function save() {
    if (!saveName.trim()) return;
    saving = true;
    saveError = null;
    try {
      const { filters, sortConfig, columns } = getState();
      await createView({
        id: crypto.randomUUID(),
        name: saveName.trim(),
        entity_type: entityType,
        filters: JSON.stringify(filters),
        sort_config: sortConfig ? JSON.stringify(sortConfig) : undefined,
        columns: columns ? JSON.stringify(columns) : undefined,
        is_default: false,
      });
      saveName = "";
      showSaveForm = false;
      await reload();
    } catch (e) {
      saveError = String(e);
    } finally {
      saving = false;
    }
  }

  async function setDefault(view: UserViewDto) {
    await updateView(view.id, { is_default: !view.is_default });
    await reload();
  }

  async function remove(view: UserViewDto) {
    await deleteView(view.id);
    await reload();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
      showSaveForm = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative">
  <button
    class="h-8 px-3 text-sm border border-border rounded bg-background hover:bg-muted transition-colors flex items-center gap-1.5"
    onclick={() => { open = !open; showSaveForm = false; }}
    aria-expanded={open}
  >
    <span>Views</span>
    {#if views.some((v) => v.is_default)}
      <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
    {/if}
    <span class="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
  </button>

  {#if open}
    <!-- Click-outside overlay -->
    <div
      class="fixed inset-0 z-10"
      role="button"
      tabindex="-1"
      aria-label="Close views panel"
      onclick={() => { open = false; showSaveForm = false; }}
      onkeydown={() => {}}
    ></div>

    <div
      class="absolute right-0 top-10 z-20 w-72 rounded-lg border border-border bg-background shadow-lg p-3 space-y-2"
    >
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Saved Views
        </span>
        <button
          class="text-xs text-primary hover:underline"
          onclick={() => { showSaveForm = !showSaveForm; }}
        >
          {showSaveForm ? "Cancel" : "+ Save current"}
        </button>
      </div>

      {#if showSaveForm}
        <div class="flex gap-1">
          <input
            type="text"
            placeholder="View name…"
            bind:value={saveName}
            onkeydown={(e) => { if (e.key === "Enter") save(); }}
            class="flex-1 h-7 px-2 text-xs border border-border rounded bg-background"
            bind:this={saveInput}
          />
          <button
            class="h-7 px-2 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
            onclick={save}
            disabled={saving || !saveName.trim()}
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
        {#if saveError}
          <p class="text-xs text-destructive">{saveError}</p>
        {/if}
      {/if}

      {#if views.length === 0}
        <p class="text-xs text-muted-foreground py-2 text-center">No saved views yet.</p>
      {:else}
        <ul class="space-y-1 max-h-64 overflow-y-auto">
          {#each views as view (view.id)}
            <li class="flex items-center gap-1 group rounded px-1 py-0.5 hover:bg-muted/50">
              <button
                class="flex-1 text-left text-sm truncate"
                onclick={() => load(view)}
                title={view.name}
              >
                {view.name}
              </button>

              <!-- Default star -->
              <button
                class="shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity
                  {view.is_default ? 'text-yellow-500 opacity-100' : 'text-muted-foreground'}"
                title={view.is_default ? "Default (click to unset)" : "Set as default"}
                onclick={() => setDefault(view)}
              >
                ★
              </button>

              <!-- Delete -->
              <button
                class="shrink-0 text-xs text-muted-foreground opacity-0 group-hover:opacity-100
                  transition-opacity hover:text-destructive"
                title="Delete view"
                onclick={() => remove(view)}
              >
                ✕
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>
