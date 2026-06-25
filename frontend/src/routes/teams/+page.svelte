<script lang="ts">
  import { onMount } from "svelte";
  import { listTeams, type TeamDto } from "$lib/api";

  let allTeams = $state<TeamDto[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let search = $state("");
  let sortKey = $state<keyof TeamDto>("full_name");
  let sortDesc = $state(false);

  onMount(async () => {
    try {
      const res = await listTeams();
      allTeams = res.data;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  });

  const filtered = $derived(() => {
    const q = search.trim().toLowerCase();
    let rows = q
      ? allTeams.filter(
          (t) =>
            t.full_name.toLowerCase().includes(q) ||
            t.city.toLowerCase().includes(q) ||
            t.abbreviation.toLowerCase().includes(q)
        )
      : allTeams;
    return [...rows].sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  });

  function toggleSort(key: keyof TeamDto) {
    if (sortKey === key) {
      sortDesc = !sortDesc;
    } else {
      sortKey = key;
      sortDesc = false;
    }
  }

  const COLS: { key: keyof TeamDto; label: string }[] = [
    { key: "full_name", label: "Team" },
    { key: "abbreviation", label: "ABV" },
    { key: "city", label: "City" },
    { key: "league_id", label: "League" },
  ];
</script>

<div class="p-6 max-w-screen-lg mx-auto">
  <div class="flex items-center justify-between mb-4 gap-4 flex-wrap">
    <h1 class="text-2xl font-semibold">Teams</h1>
    <input
      type="text"
      placeholder="Search teams…"
      bind:value={search}
      class="h-8 px-3 text-sm border border-border rounded bg-background w-56"
    />
  </div>

  {#if loading}
    <p class="text-muted-foreground text-sm">Loading…</p>
  {:else if error}
    <p class="text-destructive text-sm">{error}</p>
  {:else}
    <p class="text-muted-foreground text-xs mb-3">
      {filtered().length} of {allTeams.length} teams
    </p>
    <div class="rounded border border-border overflow-hidden">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            {#each COLS as col}
              <th
                class="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer select-none
                  hover:text-foreground whitespace-nowrap"
                onclick={() => toggleSort(col.key)}
              >
                {col.label}
                {#if sortKey === col.key}
                  {sortDesc ? "↓" : "↑"}
                {/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each filtered() as team (team.id)}
            <tr class="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td class="px-3 py-2">
                <a
                  href="/teams/{team.id}"
                  class="font-medium hover:underline"
                >
                  {team.city} {team.full_name}
                </a>
              </td>
              <td class="px-3 py-2 text-muted-foreground">{team.abbreviation}</td>
              <td class="px-3 py-2 text-muted-foreground">{team.city}</td>
              <td class="px-3 py-2 text-muted-foreground text-xs">{team.league_id}</td>
            </tr>
          {/each}
          {#if filtered().length === 0}
            <tr>
              <td colspan="4" class="px-3 py-8 text-center text-muted-foreground text-sm">
                No teams match "{search}"
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</div>
