<script lang="ts">
  import { onMount } from "svelte";
  import { listSeasons, type SeasonDto } from "$lib/api";

  let seasons: SeasonDto[] = $state([]);
  let status = $state("Loading…");

  onMount(async () => {
    try {
      const res = await listSeasons();
      seasons = res.data;
      status = `${seasons.length} season(s) in DB`;
    } catch (e) {
      status = `No database connection — ${e}`;
    }
  });
</script>

<div class="p-6 max-w-xl">
  <h1 class="text-3xl font-bold mb-2">Metis</h1>
  <p class="text-muted-foreground text-sm mb-6">{status}</p>

  <div class="flex gap-4">
    <a
      href="/players"
      class="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
    >
      Players →
    </a>
    <a
      href="/teams"
      class="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
    >
      Teams →
    </a>
  </div>
</div>
