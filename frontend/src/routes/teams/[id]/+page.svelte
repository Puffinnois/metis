<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import {
    getTeam,
    listPlayerStats,
    listSeasons,
    type TeamDto,
    type PlayerStatsRowDto,
    type SeasonDto,
  } from "$lib/api";
  import {
    createTable,
    getCoreRowModel,
    getSortedRowModel,
    type ColumnDef,
    type SortingState,
  } from "@tanstack/table-core";

  // ---------------------------------------------------------------------------
  // Team header
  // ---------------------------------------------------------------------------

  let team = $state<TeamDto | null>(null);
  let headerError = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // Roster stats
  // ---------------------------------------------------------------------------

  let rosterRows = $state<PlayerStatsRowDto[]>([]);
  let rosterLoading = $state(true);
  let rosterError = $state<string | null>(null);
  let sorting = $state<SortingState>([{ id: "points", desc: true }]);
  let displayMode = $state("per_game");
  let seasonId = $state("");
  let seasonType = $state("Regular");
  let seasons = $state<SeasonDto[]>([]);

  const ROSTER_COLS: ColumnDef<PlayerStatsRowDto>[] = [
    {
      id: "player_id",
      accessorKey: "player_id",
      header: "Player",
      cell: (info) => info.getValue<string>().replace(/^NBA_/, ""),
    },
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
        r.field_goals_made != null &&
        r.field_goals_attempted != null &&
        r.field_goals_attempted > 0
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

  const rosterTable = $derived(
    createTable<PlayerStatsRowDto>({
      data: rosterRows,
      columns: ROSTER_COLS,
      state: { sorting },
      onStateChange: () => {},
      onSortingChange: (updater) => {
        sorting = typeof updater === "function" ? updater(sorting) : updater;
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      renderFallbackValue: "—",
    })
  );

  async function fetchRoster() {
    const id = $page.params.id;
    if (!id) return;
    rosterLoading = true;
    rosterError = null;
    try {
      const res = await listPlayerStats({
        team_id: id,
        season_id: seasonId || undefined,
        season_type: seasonType || undefined,
        display_mode: displayMode,
        page_size: 30,
      });
      rosterRows = res.rows;
    } catch (e) {
      rosterError = String(e);
    } finally {
      rosterLoading = false;
    }
  }

  onMount(async () => {
    const id = $page.params.id;
    if (!id) return;

    try {
      const [teamRes, seasonsRes] = await Promise.all([
        getTeam(id).catch(() => null),
        listSeasons(),
      ]);
      if (teamRes) team = teamRes.data;
      seasons = seasonsRes.data.sort((a, b) => b.id.localeCompare(a.id));
      if (seasons.length > 0 && !seasonId) {
        seasonId = seasons[0].id;
      }
    } catch (e) {
      headerError = String(e);
    }

    await fetchRoster();
  });

  const DISPLAY_MODES = [
    { value: "totals", label: "Totals" },
    { value: "per_game", label: "Per Game" },
    { value: "per_36", label: "Per 36" },
    { value: "per_100", label: "Per 100" },
  ];

  const SEASON_TYPES = [
    { value: "Regular", label: "Regular" },
    { value: "Playoffs", label: "Playoffs" },
    { value: "PlayIn", label: "Play-In" },
    { value: "", label: "All" },
  ];
</script>

<div class="p-6 max-w-screen-xl mx-auto space-y-8">
  <!-- Header -->
  {#if headerError}
    <p class="text-destructive text-sm">{headerError}</p>
  {:else if team}
    <div>
      <h1 class="text-3xl font-bold tracking-tight">{team.city} {team.full_name}</h1>
      <p class="text-muted-foreground text-sm mt-1">
        {team.abbreviation} · {team.league_id} · {team.id}
      </p>
    </div>
  {:else}
    <div class="h-10 w-72 bg-muted animate-pulse rounded"></div>
  {/if}

  <!-- Roster stats -->
  <section>
    <div class="flex items-center gap-3 mb-3 flex-wrap">
      <h2 class="text-lg font-semibold">Roster Stats</h2>

      <!-- Season selector -->
      <select
        bind:value={seasonId}
        onchange={fetchRoster}
        class="h-8 px-2 text-sm border border-border rounded bg-background"
      >
        {#each seasons as s}
          <option value={s.id}>{s.id}</option>
        {/each}
      </select>

      <!-- Season type -->
      <select
        bind:value={seasonType}
        onchange={fetchRoster}
        class="h-8 px-2 text-sm border border-border rounded bg-background"
      >
        {#each SEASON_TYPES as st}
          <option value={st.value}>{st.label}</option>
        {/each}
      </select>

      <!-- Display mode -->
      <div class="flex gap-1 ml-auto">
        {#each DISPLAY_MODES as mode}
          <button
            class="px-3 py-1 text-xs rounded border transition-colors
              {displayMode === mode.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:text-foreground'}"
            onclick={() => {
              displayMode = mode.value;
              fetchRoster();
            }}
          >
            {mode.label}
          </button>
        {/each}
      </div>
    </div>

    {#if rosterLoading}
      <p class="text-muted-foreground text-sm">Loading…</p>
    {:else if rosterError}
      <p class="text-destructive text-sm">{rosterError}</p>
    {:else if rosterRows.length === 0}
      <p class="text-muted-foreground text-sm">No roster data found for this selection.</p>
    {:else}
      <div class="overflow-x-auto rounded border border-border">
        <table class="w-full text-sm border-collapse">
          <thead>
            {#each rosterTable.getHeaderGroups() as hg}
              <tr class="border-b border-border bg-muted/50">
                {#each hg.headers as header}
                  <th
                    class="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap
                      {header.column.getCanSort()
                      ? 'cursor-pointer select-none hover:text-foreground'
                      : ''}"
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
            {#each rosterTable.getRowModel().rows as row}
              <tr class="border-b border-border/50 hover:bg-muted/30 transition-colors">
                {#each row.getVisibleCells() as cell}
                  {@const isPlayer = cell.column.id === "player_id"}
                  {@const rawId = isPlayer
                    ? (cell.row.original.player_id)
                    : null}
                  <td class="px-3 py-2 tabular-nums whitespace-nowrap">
                    {#if isPlayer && rawId}
                      <a href="/players/{rawId}" class="hover:underline font-medium">
                        {cell.getValue()}
                      </a>
                    {:else}
                      {cell.getValue()}
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted-foreground mt-2">{rosterRows.length} player rows</p>
    {/if}
  </section>
</div>
