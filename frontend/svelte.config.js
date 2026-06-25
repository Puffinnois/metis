import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // SPA fallback allows dynamic [id] routes to be handled client-side,
      // which is what Tauri needs (it serves static files, no SSR).
      fallback: "index.html",
    }),
  },
};

export default config;
