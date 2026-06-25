<script lang="ts">
  import { onMount } from "svelte";
  import { listTeams, type TeamDto } from "$lib/api";

  let teams: TeamDto[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await listTeams();
      teams = res.data;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  });
</script>

<div class="p-6">
  <h1 class="text-2xl font-semibold mb-4">Teams</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading…</p>
  {:else if error}
    <p class="text-destructive">{error}</p>
  {:else}
    <p class="text-muted-foreground text-sm mb-4">{teams.length} teams</p>
    <!-- T074 will replace this with TanStack Table -->
    <ul class="divide-y divide-border text-sm">
      {#each teams as t (t.id)}
        <li class="py-2">
          <a href="/teams/{t.id}" class="hover:underline font-medium">
            {t.city} {t.full_name}
          </a>
          <span class="text-muted-foreground ml-2">{t.abbreviation}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
