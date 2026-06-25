<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { getTeam, type TeamDto } from "$lib/api";

  let team: TeamDto | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await getTeam($page.params.id ?? "");
      team = res.data;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  });
</script>

<div class="p-6">
  {#if loading}
    <p class="text-muted-foreground">Loading…</p>
  {:else if error}
    <p class="text-destructive">{error}</p>
  {:else if team}
    <h1 class="text-2xl font-semibold mb-1">{team.city} {team.full_name}</h1>
    <p class="text-muted-foreground text-sm mb-6">{team.abbreviation} · {team.id}</p>
    <!-- T074 will add team stats and roster -->
    <p class="text-muted-foreground text-sm">Team detail coming in T074.</p>
  {/if}
</div>
