<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { getPlayer, type PlayerDto } from "$lib/api";

  let player: PlayerDto | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await getPlayer($page.params.id ?? "");
      player = res.data;
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
  {:else if player}
    <h1 class="text-2xl font-semibold mb-1">{player.first_name} {player.last_name}</h1>
    <p class="text-muted-foreground text-sm mb-6">{player.league_id} · {player.id}</p>
    <!-- T073 will add career stats, season splits, and game log -->
    <p class="text-muted-foreground text-sm">Player detail coming in T073.</p>
  {/if}
</div>
