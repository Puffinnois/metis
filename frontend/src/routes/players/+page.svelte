<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import {
    createTable,
    getCoreRowModel,
    getSortedRowModel,
    type ColumnDef,
    type SortingState,
  } from "@tanstack/table-core";
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import {
    listPlayerStats,
    listSeasons,
    listTeams,
    type PlayerStatsRowDto,
    type SeasonDto,
    type TeamDto,
  } from "$lib/api";
  import SavedViews from "$lib/SavedViews.svelte";

  // ---------------------------------------------------------------------------
  // Column group definitions
  // ---------------------------------------------------------------------------

  type ColGroup = "traditional" | "shooting" | "advanced" | "lineup";

  const fmt = (v: number | null | undefined, d = 1) =>
    v == null ? "—" : v.toFixed(d);
  const pct = (m: number | null | undefined, a: number | null | undefined) =>
    m != null && a != null && a > 0 ? ((m / a) * 100).toFixed(1) + "%" : "—";
  const tsPercent = (r: PlayerStatsRowDto) => {
    const pts = r.points ?? 0, fga = r.field_goals_attempted ?? 0, fta = r.free_throws_attempted ?? 0;
    const denom = 2 * (fga + 0.44 * fta);
    return denom > 0 ? ((pts / denom) * 100).toFixed(1) + "%" : "—";
  };
  const efgPercent = (r: PlayerStatsRowDto) => {
    const fgm = r.field_goals_made ?? 0, tpm = r.three_pointers_made ?? 0, fga = r.field_goals_attempted ?? 0;
    return fga > 0 ? (((fgm + 0.5 * tpm) / fga) * 100).toFixed(1) + "%" : "—";
  };

  const colDefs: Record<ColGroup, ColumnDef<PlayerStatsRowDto>[]> = {
    traditional: [
      { accessorKey: "player_id", header: "Player", size: 140, enableSorting: true },
      { accessorKey: "season_id", header: "Season", size: 80, enableSorting: true },
      { accessorKey: "games_played", header: "GP", size: 55, enableSorting: true },
      { accessorKey: "minutes_played", header: "MIN", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "points", header: "PTS", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "rebounds_total", header: "REB", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "assists", header: "AST", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "steals", header: "STL", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "blocks", header: "BLK", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "turnovers", header: "TOV", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "personal_fouls", header: "PF", size: 55, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
    ],
    shooting: [
      { accessorKey: "player_id", header: "Player", size: 140, enableSorting: true },
      { accessorKey: "season_id", header: "Season", size: 80, enableSorting: true },
      { accessorKey: "field_goals_made", header: "FGM", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "field_goals_attempted", header: "FGA", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { id: "fg_pct", header: "FG%", size: 65, enableSorting: false, cell: (i) => pct(i.row.original.field_goals_made, i.row.original.field_goals_attempted) },
      { accessorKey: "three_pointers_made", header: "3PM", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "three_pointers_attempted", header: "3PA", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { id: "three_pct", header: "3P%", size: 65, enableSorting: false, cell: (i) => pct(i.row.original.three_pointers_made, i.row.original.three_pointers_attempted) },
      { accessorKey: "free_throws_made", header: "FTM", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { accessorKey: "free_throws_attempted", header: "FTA", size: 65, enableSorting: true, cell: (i) => fmt(i.getValue<number | null>()) },
      { id: "ft_pct", header: "FT%", size: 65, enableSorting: false, cell: (i) => pct(i.row.original.free_throws_made, i.row.original.free_throws_attempted) },
    ],
    advanced: [
      { accessorKey: "player_id", header: "Player", size: 140, enableSorting: true },
      { accessorKey: "season_id", header: "Season", size: 80, enableSorting: true },
      { accessorKey: "games_played", header: "GP", size: 55, enableSorting: true },
      { id: "ts_pct", header: "TS%", size: 80, enableSorting: false, cell: (i) => tsPercent(i.row.original) },
      { id: "efg_pct", header: "eFG%", size: 80, enableSorting: false, cell: (i) => efgPercent(i.row.original) },
      { id: "fg_pct", header: "FG%", size: 80, enableSorting: false, cell: (i) => pct(i.row.original.field_goals_made, i.row.original.field_goals_attempted) },
      { id: "three_pct", header: "3P%", size: 80, enableSorting: false, cell: (i) => pct(i.row.original.three_pointers_made, i.row.original.three_pointers_attempted) },
      { id: "ft_pct", header: "FT%", size: 80, enableSorting: false, cell: (i) => pct(i.row.original.free_throws_made, i.row.original.free_throws_attempted) },
    ],
    lineup: [
      { accessorKey: "player_id", header: "Player", size: 140, enableSorting: true },
      { accessorKey: "season_id", header: "Season", size: 80, enableSorting: true },
      { accessorKey: "games_played", header: "GP", size: 55, enableSorting: true },
      { id: "on_off", header: "On-Off", size: 90, enableSorting: false, cell: () => "—" },
      { id: "net_rtg", header: "Net Rtg", size: 90, enableSorting: false, cell: () => "—" },
    ],
  };

  // Sort columns that can be passed to the server
  const SERVER_SORT_COLS = new Set([
    "player_id", "season_id", "games_played", "minutes_played", "points",
    "rebounds_total", "assists", "steals", "blocks", "turnovers",
    "personal_fouls", "field_goals_made", "field_goals_attempted",
    "three_pointers_made", "three_pointers_attempted",
    "free_throws_made", "free_throws_attempted",
  ]);

  // ---------------------------------------------------------------------------
  // Filter state
  // ---------------------------------------------------------------------------

  let activeGroup: ColGroup = $state("traditional");
  let displayMode = $state("per_game");
  let seasonId = $state("");
  let seasonType = $state("");
  let teamId = $state("");
  let homeAway = $state("");
  let winLoss = $state("");
  let seasons: SeasonDto[] = $state([]);
  let teams: TeamDto[] = $state([]);

  // ---------------------------------------------------------------------------
  // Table state
  // ---------------------------------------------------------------------------

  let rows: PlayerStatsRowDto[] = $state([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let sorting: SortingState = $state([{ id: "points", desc: true }]);

  // Rebuild table whenever data or active column group changes.
  // @tanstack/table-core is framework-agnostic: just call createTable() as a
  // pure function and treat it as a $derived computation.
  const table = $derived(
    createTable<PlayerStatsRowDto>({
      data: rows,
      columns: colDefs[activeGroup],
      state: { sorting },
      // State is managed externally via `sorting` $state; onStateChange is a no-op.
      onStateChange: () => {},
      onSortingChange: (updater) => {
        sorting = typeof updater === "function" ? updater(sorting) : updater;
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      manualSorting: true,
      renderFallbackValue: "—",
    })
  );

  // ---------------------------------------------------------------------------
  // Virtual scroll — @tanstack/svelte-virtual returns a Svelte 4 Readable store.
  // We pass a writable options store so we can update `count` reactively.
  // ---------------------------------------------------------------------------

  let scrollEl: HTMLDivElement | undefined = $state();
  const ROW_HEIGHT = 36;

  // createVirtualizer needs a plain options object (not a Readable).
  // We update count reactively via get(virtualizer).setOptions(...).
  const virtualizer = createVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: 0,
    getScrollElement: () => scrollEl!,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Keep virtualizer count in sync with rendered rows.
  $effect(() => {
    const count = table.getRowModel().rows.length;
    get(virtualizer).setOptions({ count });
  });

  // ---------------------------------------------------------------------------
  // Data fetching — debounced 150 ms on filter changes, immediate on sort
  // ---------------------------------------------------------------------------

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleRefetch() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void fetchStats(), 150);
  }

  async function fetchStats() {
    loading = true;
    error = null;
    try {
      const col = sorting[0];
      const sortBy = col && SERVER_SORT_COLS.has(col.id) ? col.id : "points";
      const sortDir = col?.desc === false ? "asc" : "desc";

      const result = await listPlayerStats({
        season_id: seasonId || undefined,
        season_type: seasonType || undefined,
        team_id: teamId || undefined,
        home_away: homeAway || undefined,
        win_loss: winLoss || undefined,
        display_mode: displayMode,
        sort_by: sortBy,
        sort_dir: sortDir,
        page_size: 200,
      });
      rows = result.rows;
      total = result.total;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  // Watch filters — debounce
  $effect(() => {
    void seasonId; void seasonType; void teamId;
    void homeAway; void winLoss; void displayMode;
    scheduleRefetch();
  });

  // Watch sort — immediate re-fetch (server-side sort)
  $effect(() => {
    void sorting;
    void fetchStats();
  });

  onMount(async () => {
    const [s, t] = await Promise.all([listSeasons(), listTeams()]);
    seasons = s.data;
    teams = t.data;
  });

  // ---------------------------------------------------------------------------
  // Saved-view integration
  // ---------------------------------------------------------------------------

  function loadView(
    filters: Record<string, string>,
    sortConfig: Record<string, string> | null,
    columns: Record<string, string> | null,
  ) {
    if (filters.season_id !== undefined) seasonId = filters.season_id;
    if (filters.season_type !== undefined) seasonType = filters.season_type;
    if (filters.team_id !== undefined) teamId = filters.team_id;
    if (filters.home_away !== undefined) homeAway = filters.home_away;
    if (filters.win_loss !== undefined) winLoss = filters.win_loss;
    if (filters.display_mode !== undefined) displayMode = filters.display_mode;
    if (sortConfig?.sort_by) {
      sorting = [{ id: sortConfig.sort_by, desc: sortConfig.sort_dir !== "asc" }];
    }
    if (columns?.active_group && ["traditional","shooting","advanced","lineup"].includes(columns.active_group)) {
      activeGroup = columns.active_group as ColGroup;
    }
  }

  function getState() {
    const col = sorting[0];
    return {
      filters: {
        season_id: seasonId,
        season_type: seasonType,
        team_id: teamId,
        home_away: homeAway,
        win_loss: winLoss,
        display_mode: displayMode,
      },
      sortConfig: col ? { sort_by: col.id, sort_dir: col.desc ? "desc" : "asc" } : null,
      columns: { active_group: activeGroup },
    };
  }
</script>

<div class="flex flex-col" style="height: calc(100vh - 49px);">
  <!-- Filter bar -->
  <div class="border-b border-border px-4 py-2 flex flex-wrap items-center gap-2 bg-muted/20 shrink-0">
    <select class="rounded border border-border bg-background px-2 py-1 text-xs" bind:value={displayMode}>
      <option value="per_game">Per Game</option>
      <option value="totals">Totals</option>
      <option value="per_36">Per 36</option>
      <option value="per_100">Per 100</option>
    </select>

    <select class="rounded border border-border bg-background px-2 py-1 text-xs" bind:value={seasonId}>
      <option value="">All Seasons</option>
      {#each seasons as s (s.id)}
        <option value={s.id}>{s.id}</option>
      {/each}
    </select>

    <select class="rounded border border-border bg-background px-2 py-1 text-xs" bind:value={seasonType}>
      <option value="">All Types</option>
      <option value="Regular">Regular</option>
      <option value="Playoffs">Playoffs</option>
      <option value="PlayIn">Play-In</option>
    </select>

    <select class="rounded border border-border bg-background px-2 py-1 text-xs" bind:value={teamId}>
      <option value="">All Teams</option>
      {#each teams as t (t.id)}
        <option value={t.id}>{t.abbreviation}</option>
      {/each}
    </select>

    <select class="rounded border border-border bg-background px-2 py-1 text-xs" bind:value={homeAway}>
      <option value="">Home/Away</option>
      <option value="home">Home</option>
      <option value="away">Away</option>
    </select>

    <select class="rounded border border-border bg-background px-2 py-1 text-xs" bind:value={winLoss}>
      <option value="">W/L</option>
      <option value="win">Wins</option>
      <option value="loss">Losses</option>
    </select>

    <div class="ml-auto flex items-center gap-3">
      <SavedViews entityType="player" onload={loadView} {getState} />
      <span class="text-muted-foreground text-xs">
        {#if loading}Loading…{:else}{rows.length} / {total}{/if}
      </span>
    </div>
    {#if error}<span class="text-destructive text-xs w-full">{error}</span>{/if}
  </div>

  <!-- Column group tabs -->
  <div class="border-b border-border px-4 flex gap-0 bg-background shrink-0">
    {#each (["traditional", "shooting", "advanced", "lineup"] as ColGroup[]) as g}
      <button
        class="px-4 py-2 text-xs font-medium border-b-2 transition-colors capitalize
          {activeGroup === g
            ? 'border-foreground text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'}"
        onclick={() => { activeGroup = g; }}
      >
        {g}
      </button>
    {/each}
  </div>

  <!-- Table with virtual scroll -->
  <div class="flex-1 overflow-auto" bind:this={scrollEl}>
    <table class="w-full border-collapse text-sm" style="table-layout: fixed;">
      <thead class="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
        {#each table.getHeaderGroups() as headerGroup}
          <tr>
            {#each headerGroup.headers as header}
              {@const canSort = header.column.getCanSort()}
              <th
                class="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap select-none
                  {canSort ? 'cursor-pointer hover:text-foreground' : ''}"
                style="width: {header.getSize()}px;"
                onclick={() => canSort && header.column.toggleSorting()}
              >
                {#if typeof header.column.columnDef.header === "string"}
                  {header.column.columnDef.header}
                {/if}
                {#if header.column.getIsSorted() === "asc"}
                  <span class="ml-0.5">↑</span>
                {:else if header.column.getIsSorted() === "desc"}
                  <span class="ml-0.5">↓</span>
                {:else if canSort}
                  <span class="ml-0.5 opacity-25">↕</span>
                {/if}
              </th>
            {/each}
          </tr>
        {/each}
      </thead>
      <tbody style="height: {$virtualizer.getTotalSize()}px; position: relative; display: block;">
        {#each $virtualizer.getVirtualItems() as vRow (vRow.index)}
          {@const row = table.getRowModel().rows[vRow.index]}
          {#if row}
            <tr
              class="absolute w-full border-b border-border hover:bg-muted/30 transition-colors"
              style="top: {vRow.start}px; height: {ROW_HEIGHT}px; display: flex;"
            >
              {#each row.getVisibleCells() as cell}
                <td
                  class="px-3 flex items-center overflow-hidden text-ellipsis whitespace-nowrap tabular-nums"
                  style="width: {cell.column.getSize()}px; min-width: {cell.column.getSize()}px;"
                >
                  {#if typeof cell.column.columnDef.cell === "function"}
                    {cell.column.columnDef.cell(cell.getContext())}
                  {:else}
                    {cell.getValue() ?? "—"}
                  {/if}
                </td>
              {/each}
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
</div>
