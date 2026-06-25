<script lang="ts">
  import { onMount } from "svelte";
  import { listPlayers, type PlayerDto } from "$lib/api";

  let players: PlayerDto[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await listPlayers();
      players = res.data;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  });
</script>

<div class="p-6">
  <h1 class="text-2xl font-semibold mb-4">Players</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading…</p>
  {:else if error}
    <p class="text-destructive">{error}</p>
  {:else}
    <p class="text-muted-foreground text-sm mb-4">{players.length} players</p>
    <!-- T072 will replace this with TanStack Table + virtualization -->
    <ul class="divide-y divide-border text-sm">
      {#each players as p (p.id)}
        <li class="py-2">
          <a href="/players/{p.id}" class="hover:underline font-medium">
            {p.first_name} {p.last_name}
          </a>
          <span class="text-muted-foreground ml-2">{p.league_id}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
