<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";

  let { children } = $props();

  const navLinks = [
    { href: "/players", label: "Players" },
    { href: "/teams", label: "Teams" },
  ];
</script>

<div class="min-h-screen flex flex-col bg-background text-foreground">
  <header class="border-b border-border px-6 py-3 flex items-center gap-6">
    <a href="/" class="font-bold text-lg tracking-tight">Metis</a>
    <nav class="flex gap-4 text-sm">
      {#each navLinks as link (link.href)}
        <a
          href={link.href}
          class="hover:text-foreground transition-colors {$page.url.pathname.startsWith(link.href)
            ? 'text-foreground font-medium'
            : 'text-muted-foreground'}"
        >
          {link.label}
        </a>
      {/each}
    </nav>
  </header>

  <main class="flex-1">
    {@render children()}
  </main>
</div>
