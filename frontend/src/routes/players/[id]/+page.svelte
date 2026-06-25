<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import {
    getPlayer,
    listPlayerStats,
    getPlayerGameLog,
    type PlayerDto,
    type PlayerStatsRowDto,
    type PlayerGameLogRow,
  } from "$lib/api";
  import {
    createTable,
    getCoreRowModel,
    getSortedRowModel,
    type ColumnDef,
    type SortingState,
  } from "@tanstack/table-core";

  // ---------------------------------------------------------------------------
  // Player header
  // ---------------------------------------------------------------------------

  let player = $state<PlayerDto | null>(null);
  let headerError = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // Season splits (career stats per season)
  // ---------------------------------------------------------------------------

  let splitRows = $state<PlayerStatsRowDto[]>([]);
  let splitsLoading = $state(true);
  let splitsError = $state<string | null>(null);
  let splitsSorting = $state<SortingState>([{ id: "season_id", desc: true }]);
  let splitsDisplayMode = $state("totals");

  const SPLITS_COLS: ColumnDef<PlayerStatsRowDto>[] = [
    { accessorKey: "season_id", header: "Season" },
    { accessorKey: "season_type", header: "Type" },
    {
      id: "games_played",
      accessorFn: (r) => r.games_played,
      header: "G",
    },
    {
      id: "minutes_played",
      accessorFn: (r) => r.minutes_played?.toFixed(1) ?? "—",
      header: "MIN",
    },
    {
      id: "points",
      accessorFn: (r) => r.points?.toFixed(1) ?? "—",
      header: "PTS",
    },
    {
      id: "rebounds_total",
      accessorFn: (r) => r.rebounds_total?.toFixed(1) ?? "—",
      header: "REB",
    },
    {
      id: "assists",
      accessorFn: (r) => r.assists?.toFixed(1) ?? "—",
      header: "AST",
    },
    {
      id: "steals",
      accessorFn: (r) => r.steals?.toFixed(1) ?? "—",
      header: "STL",
    },
    {
      id: "blocks",
      accessorFn: (r) => r.blocks?.toFixed(1) ?? "—",
      header: "BLK",
    },
    {
      id: "turnovers",
      accessorFn: (r) => r.turnovers?.toFixed(1) ?? "—",
      header: "TOV",
    },
    {
      id: "fg_pct",
      accessorFn: (r) =>
        r.field_goals_made != null && r.field_goals_attempted != null && r.field_goals_attempted > 0
          ? ((r.field_goals_made / r.field_goals_attempted) * 100).toFixed(1) + "%"
          : "—",
      header: "FG%",
    },
    {
      id: "three_pct",
      accessorFn: (r) =>
        r.three_pointers_made != null &&
        r.three_pointers_attempted != null &&
        r.three_pointers_attempted > 0
          ? ((r.three_pointers_made / r.three_pointers_attempted) * 100).toFixed(1) + "%"
          : "—",
      header: "3P%",
    },
    {
      id: "ft_pct",
      accessorFn: (r) =>
        r.free_throws_made != null &&
        r.free_throws_attempted != null &&
        r.free_throws_attempted > 0
          ? ((r.free_throws_made / r.free_throws_attempted) * 100).toFixed(1) + "%"
          : "—",
      header: "FT%",
    },
    {
      id: "ts_pct",
      accessorFn: (r) => {
        const pts = r.points;
        const fga = r.field_goals_attempted;
        const fta = r.free_throws_attempted;
        if (pts == null || fga == null || fta == null) return "—";
        const denom = 2 * (fga + 0.44 * fta);
        return denom > 0 ? ((pts / denom) * 100).toFixed(1) + "%" : "—";
      },
      header: "TS%",
    },
  ];

  const splitsTable = $derived(
    createTable<PlayerStatsRowDto>({
      data: splitRows,
      columns: SPLITS_COLS,
      state: { sorting: splitsSorting },
      onStateChange: () => {},
      onSortingChange: (updater) => {
        splitsSorting =
          typeof updater === "function" ? updater(splitsSorting) : updater;
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      renderFallbackValue: "—",
    })
  );

  async function fetchSplits() {
    const id = $page.params.id;
    if (!id) return;
    splitsLoading = true;
    splitsError = null;
    try {
      const res = await listPlayerStats({
        player_id: id,
        display_mode: splitsDisplayMode,
        page_size: 200,
      });
      splitRows = res.rows;
    } catch (e) {
      splitsError = String(e);
    } finally {
      splitsLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Game log
  // ---------------------------------------------------------------------------

  let logRows = $state<PlayerGameLogRow[]>([]);
  let logLoading = $state(true);
  let logError = $state<string | null>(null);
  let logSeasonId = $state("");
  let logSeasonType = $state("");

  let logDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleLogFetch() {
    if (logDebounceTimer) clearTimeout(logDebounceTimer);
    logDebounceTimer = setTimeout(fetchLog, 150);
  }

  async function fetchLog() {
    const id = $page.params.id;
    if (!id) return;
    logLoading = true;
    logError = null;
    try {
      logRows = await getPlayerGameLog({
        player_id: id,
        season_id: logSeasonId || undefined,
        season_type: logSeasonType || undefined,
        limit: 100,
      });
    } catch (e) {
      logError = String(e);
    } finally {
      logLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Mount
  // ---------------------------------------------------------------------------

  onMount(async () => {
    const id = $page.params.id;
    if (!id) return;
    try {
      const res = await getPlayer(id);
      player = res.data;
    } catch (e) {
      headerError = String(e);
    }
    await Promise.all([fetchSplits(), fetchLog()]);
  });

  function fmt(v: number | null, decimals = 1): string {
    return v != null ? v.toFixed(decimals) : "—";
  }

  function gameOpponent(row: PlayerGameLogRow): string {
    const isHome = row.team_id === row.home_team_id;
    const opp = isHome ? row.away_team_id : row.home_team_id;
    const abbr = opp.replace(/^NBA_/, "");
    return isHome ? `vs ${abbr}` : `@ ${abbr}`;
  }

  function gameResult(row: PlayerGameLogRow): string {
    if (row.home_score == null || row.away_score == null) return "—";
    const myScore =
      row.team_id === row.home_team_id ? row.home_score : row.away_score;
    const oppScore =
      row.team_id === row.home_team_id ? row.away_score : row.home_score;
    const wl = myScore > oppScore ? "W" : "L";
    return `${wl} ${myScore}-${oppScore}`;
  }

  const DISPLAY_MODES = [
    { value: "totals", label: "Totals" },
    { value: "per_game", label: "Per Game" },
    { value: "per_36", label: "Per 36" },
    { value: "per_100", label: "Per 100" },
  ];

  const SEASON_TYPES = [
    { value: "", label: "All" },
    { value: "Regular", label: "Regular" },
    { value: "Playoffs", label: "Playoffs" },
    { value: "PlayIn", label: "Play-In" },
  ];
</script>

<div class="p-6 max-w-screen-xl mx-auto space-y-8">
  <!-- Header -->
  {#if headerError}
    <p class="text-destructive text-sm">{headerError}</p>
  {:else if player}
    <div>
      <h1 class="text-3xl font-bold tracking-tight">
        {player.first_name}
        {player.last_name}
      </h1>
      <p class="text-muted-foreground text-sm mt-1">{player.league_id} · {player.id}</p>
    </div>
  {:else}
    <div class="h-10 w-64 bg-muted animate-pulse rounded"></div>
  {/if}

  <!-- Season splits -->
  <section>
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-semibold">Career Season Splits</h2>
      <div class="flex gap-1">
        {#each DISPLAY_MODES as mode}
          <button
            class="px-3 py-1 text-xs rounded border transition-colors
              {splitsDisplayMode === mode.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:text-foreground'}"
            onclick={() => {
              splitsDisplayMode = mode.value;
              fetchSplits();
            }}
          >
            {mode.label}
          </button>
        {/each}
      </div>
    </div>

    {#if splitsLoading}
      <p class="text-muted-foreground text-sm">Loading…</p>
    {:else if splitsError}
      <p class="text-destructive text-sm">{splitsError}</p>
    {:else if splitRows.length === 0}
      <p class="text-muted-foreground text-sm">No season data found.</p>
    {:else}
      <div class="overflow-x-auto rounded border border-border">
        <table class="w-full text-sm border-collapse">
          <thead>
            {#each splitsTable.getHeaderGroups() as hg}
              <tr class="border-b border-border bg-muted/50">
                {#each hg.headers as header}
                  <th
                    class="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap
                      {header.column.getCanSort() ? 'cursor-pointer select-none hover:text-foreground' : ''}"
                    onclick={header.column.getToggleSortingHandler()}
                  >
                    {header.column.columnDef.header}
                    {#if header.column.getIsSorted() === "asc"}↑{:else if header.column.getIsSorted() === "desc"}↓{/if}
                  </th>
                {/each}
              </tr>
            {/each}
          </thead>
          <tbody>
            {#each splitsTable.getRowModel().rows as row}
              <tr class="border-b border-border/50 hover:bg-muted/30 transition-colors">
                {#each row.getVisibleCells() as cell}
                  <td class="px-3 py-2 tabular-nums whitespace-nowrap">
                    {cell.getValue()}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <!-- Game log -->
  <section>
    <div class="flex items-center gap-4 mb-3 flex-wrap">
      <h2 class="text-lg font-semibold">Game Log</h2>
      <input
        type="text"
        placeholder="Season (e.g. 2023-24)"
        bind:value={logSeasonId}
        oninput={scheduleLogFetch}
        class="h-8 px-2 text-sm border border-border rounded bg-background w-36"
      />
      <select
        bind:value={logSeasonType}
        onchange={() => fetchLog()}
        class="h-8 px-2 text-sm border border-border rounded bg-background"
      >
        {#each SEASON_TYPES as st}
          <option value={st.value}>{st.label}</option>
        {/each}
      </select>
      <span class="text-xs text-muted-foreground ml-auto">
        {logRows.length} game{logRows.length !== 1 ? "s" : ""}
      </span>
    </div>

    {#if logLoading}
      <p class="text-muted-foreground text-sm">Loading…</p>
    {:else if logError}
      <p class="text-destructive text-sm">{logError}</p>
    {:else if logRows.length === 0}
      <p class="text-muted-foreground text-sm">No games found.</p>
    {:else}
      <div class="overflow-x-auto rounded border border-border">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-border bg-muted/50">
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">Opp</th>
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">Result</th>
              <th class="px-3 py-2 text-left font-medium text-muted-foreground">Season</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">MIN</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">PTS</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">REB</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">AST</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">STL</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">BLK</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">TOV</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">FG</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">3P</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">FT</th>
              <th class="px-3 py-2 text-right font-medium text-muted-foreground">+/-</th>
            </tr>
          </thead>
          <tbody>
            {#each logRows as row}
              <tr class="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td class="px-3 py-2 whitespace-nowrap">{row.game_date.slice(0, 10)}</td>
                <td class="px-3 py-2 whitespace-nowrap">{gameOpponent(row)}</td>
                <td class="px-3 py-2 whitespace-nowrap tabular-nums">{gameResult(row)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-muted-foreground text-xs">{row.season_id}</td>
                <td class="px-3 py-2 text-right tabular-nums">{fmt(row.minutes_played)}</td>
                <td class="px-3 py-2 text-right tabular-nums font-medium">{row.points ?? "—"}</td>
                <td class="px-3 py-2 text-right tabular-nums">{row.rebounds_total ?? "—"}</td>
                <td class="px-3 py-2 text-right tabular-nums">{row.assists ?? "—"}</td>
                <td class="px-3 py-2 text-right tabular-nums">{row.steals ?? "—"}</td>
                <td class="px-3 py-2 text-right tabular-nums">{row.blocks ?? "—"}</td>
                <td class="px-3 py-2 text-right tabular-nums">{row.turnovers ?? "—"}</td>
                <td class="px-3 py-2 text-right tabular-nums text-xs">
                  {row.field_goals_made ?? "—"}/{row.field_goals_attempted ?? "—"}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-xs">
                  {row.three_pointers_made ?? "—"}/{row.three_pointers_attempted ?? "—"}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-xs">
                  {row.free_throws_made ?? "—"}/{row.free_throws_attempted ?? "—"}
                </td>
                <td class="px-3 py-2 text-right tabular-nums
                  {row.plus_minus != null && row.plus_minus > 0
                    ? 'text-green-600 dark:text-green-400'
                    : row.plus_minus != null && row.plus_minus < 0
                      ? 'text-red-500'
                      : ''}">
                  {row.plus_minus != null
                    ? (row.plus_minus > 0 ? "+" : "") + row.plus_minus
                    : "—"}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>
