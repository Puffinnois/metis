// Typed API client. Types are generated from docs/openapi.json via `pnpm gen:api`.
// In Tauri, commands use invoke(); outside Tauri (browser dev), falls back to HTTP.

import type { components } from "./openapi.d.ts";

export type CoverageLabel = components["schemas"]["CoverageLabel"];
export type PlayerDto = components["schemas"]["PlayerDto"];
export type TeamDto = components["schemas"]["TeamDto"];
export type SeasonDto = components["schemas"]["SeasonDto"];
export type GameDto = components["schemas"]["GameDto"];

export interface ListResponse<T> {
  data: T[];
  total: number;
  coverage: CoverageLabel;
}

export interface ItemResponse<T> {
  data: T;
  coverage: CoverageLabel;
}

const HTTP_BASE = "http://127.0.0.1:3000";

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

async function httpGet<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${HTTP_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export interface ListPlayersParams {
  league_id?: string;
  search?: string;
}

export async function listPlayers(params?: ListPlayersParams): Promise<ListResponse<PlayerDto>> {
  try {
    const rows = await tauriInvoke<PlayerDto[]>("get_players");
    return { data: rows, total: rows.length, coverage: "full" };
  } catch {
    return httpGet<ListResponse<PlayerDto>>("/players", {
      league_id: params?.league_id,
      search: params?.search,
    });
  }
}

export async function getPlayer(id: string): Promise<ItemResponse<PlayerDto>> {
  return httpGet<ItemResponse<PlayerDto>>(`/players/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function listTeams(league_id?: string): Promise<ListResponse<TeamDto>> {
  try {
    const rows = await tauriInvoke<TeamDto[]>("get_teams");
    return { data: rows, total: rows.length, coverage: "full" };
  } catch {
    return httpGet<ListResponse<TeamDto>>("/teams", { league_id });
  }
}

export async function getTeam(id: string): Promise<ItemResponse<TeamDto>> {
  return httpGet<ItemResponse<TeamDto>>(`/teams/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export async function listSeasons(league_id?: string): Promise<ListResponse<SeasonDto>> {
  try {
    const rows = await tauriInvoke<SeasonDto[]>("get_seasons");
    return { data: rows, total: rows.length, coverage: "full" };
  } catch {
    return httpGet<ListResponse<SeasonDto>>("/seasons", { league_id });
  }
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export interface ListGamesParams {
  season_id?: string;
  season_type?: string;
  team_id?: string;
}

export async function listGames(params?: ListGamesParams): Promise<ListResponse<GameDto>> {
  return httpGet<ListResponse<GameDto>>("/games", {
    season_id: params?.season_id,
    season_type: params?.season_type,
    team_id: params?.team_id,
  });
}

export async function getGame(id: string): Promise<ItemResponse<GameDto>> {
  return httpGet<ItemResponse<GameDto>>(`/games/${encodeURIComponent(id)}`);
}
