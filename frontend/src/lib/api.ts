// Typed API client. All response types are generated from docs/openapi.json via
// `pnpm gen:api`. Do NOT add hand-written response shapes here — add them to the
// Rust API, regenerate the spec, then run `pnpm gen:api`.

import type { components } from "./openapi.d.ts";

// ---------------------------------------------------------------------------
// Re-exported entity types (from generated spec)
// ---------------------------------------------------------------------------

export type CoverageLabel = components["schemas"]["CoverageLabel"];
export type PlayerDto = components["schemas"]["PlayerDto"];
export type TeamDto = components["schemas"]["TeamDto"];
export type SeasonDto = components["schemas"]["SeasonDto"];
export type GameDto = components["schemas"]["GameDto"];
export type PlayerStatsRowDto = components["schemas"]["PlayerStatsRowDto"];
export type UserViewDto = components["schemas"]["UserViewDto"];

// Re-export list/item response types for callers that need the envelope.
export type PlayerListResponse = components["schemas"]["PlayerListResponse"];
export type TeamListResponse = components["schemas"]["TeamListResponse"];
export type SeasonListResponse = components["schemas"]["SeasonListResponse"];
export type GameListResponse = components["schemas"]["GameListResponse"];
export type PlayerStatsPageResponse = components["schemas"]["PlayerStatsPageResponse"];
export type ViewListResponse = components["schemas"]["ViewListResponse"];
export type ViewItemResponse = components["schemas"]["ViewItemResponse"];

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

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

export async function listPlayers(params?: ListPlayersParams): Promise<PlayerListResponse> {
  try {
    const data = await tauriInvoke<PlayerDto[]>("get_players");
    return { data, total: data.length, coverage: "full" };
  } catch {
    return httpGet<PlayerListResponse>("/players", {
      league_id: params?.league_id,
      search: params?.search,
    });
  }
}

export async function getPlayer(id: string): Promise<components["schemas"]["PlayerItemResponse"]> {
  return httpGet(`/players/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function listTeams(league_id?: string): Promise<TeamListResponse> {
  try {
    const data = await tauriInvoke<TeamDto[]>("get_teams");
    return { data, total: data.length, coverage: "full" };
  } catch {
    return httpGet<TeamListResponse>("/teams", { league_id });
  }
}

export async function getTeam(id: string): Promise<components["schemas"]["TeamItemResponse"]> {
  return httpGet(`/teams/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export async function listSeasons(league_id?: string): Promise<SeasonListResponse> {
  try {
    const data = await tauriInvoke<SeasonDto[]>("get_seasons");
    return { data, total: data.length, coverage: "full" };
  } catch {
    return httpGet<SeasonListResponse>("/seasons", { league_id });
  }
}

// ---------------------------------------------------------------------------
// Player stats
// ---------------------------------------------------------------------------

export interface PlayerStatsParams {
  season_id?: string;
  season_type?: string;
  player_id?: string;
  team_id?: string;
  home_away?: string;
  win_loss?: string;
  display_mode?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  page_size?: number;
}

export async function listPlayerStats(params?: PlayerStatsParams): Promise<PlayerStatsPageResponse> {
  try {
    return await tauriInvoke<PlayerStatsPageResponse>("get_player_stats", { params: params ?? {} });
  } catch {
    return httpGet<PlayerStatsPageResponse>("/players/stats", {
      season_id: params?.season_id,
      season_type: params?.season_type,
      player_id: params?.player_id,
      team_id: params?.team_id,
      home_away: params?.home_away,
      win_loss: params?.win_loss,
      display_mode: params?.display_mode,
      sort_by: params?.sort_by,
      sort_dir: params?.sort_dir,
      page: params?.page?.toString(),
      page_size: params?.page_size?.toString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Player game log
// ---------------------------------------------------------------------------

// Game log is a Tauri-only command with no HTTP endpoint — shape defined here.
export interface PlayerGameLogRow {
  game_id: string;
  game_date: string;
  season_id: string;
  season_type: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  player_id: string;
  team_id: string;
  source: string;
  starter: boolean | null;
  minutes_played: number | null;
  points: number | null;
  rebounds_offensive: number | null;
  rebounds_defensive: number | null;
  rebounds_total: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  personal_fouls: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  three_pointers_made: number | null;
  three_pointers_attempted: number | null;
  free_throws_made: number | null;
  free_throws_attempted: number | null;
  plus_minus: number | null;
}

export interface GameLogParams {
  player_id: string;
  season_id?: string;
  season_type?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

export async function getPlayerGameLog(params: GameLogParams): Promise<PlayerGameLogRow[]> {
  try {
    return await tauriInvoke<PlayerGameLogRow[]>("get_player_game_log", { params });
  } catch {
    // HTTP fallback not yet implemented for game log endpoint
    return [];
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

export async function listGames(params?: ListGamesParams): Promise<GameListResponse> {
  return httpGet<GameListResponse>("/games", {
    season_id: params?.season_id,
    season_type: params?.season_type,
    team_id: params?.team_id,
  });
}

export async function getGame(id: string): Promise<components["schemas"]["GameItemResponse"]> {
  return httpGet(`/games/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------

export interface CreateViewParams {
  id: string;
  name: string;
  description?: string;
  entity_type: string;
  filters?: string;
  sort_config?: string;
  columns?: string;
  is_default?: boolean;
}

export interface UpdateViewParams {
  name?: string;
  description?: string | null;
  filters?: string;
  sort_config?: string | null;
  columns?: string | null;
  is_default?: boolean;
}

export async function listViews(entity_type?: string): Promise<UserViewDto[]> {
  try {
    return await tauriInvoke<UserViewDto[]>("list_views", { entityType: entity_type });
  } catch {
    const res = await httpGet<ViewListResponse>("/views", { entity_type });
    return res.data;
  }
}

export async function createView(params: CreateViewParams): Promise<UserViewDto> {
  try {
    return await tauriInvoke<UserViewDto>("create_view", { view: params });
  } catch {
    const res = await fetch(`${HTTP_BASE}/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const envelope = (await res.json()) as ViewItemResponse;
    return envelope.data;
  }
}

export async function updateView(id: string, patch: UpdateViewParams): Promise<UserViewDto | null> {
  try {
    return await tauriInvoke<UserViewDto | null>("update_view", { id, patch });
  } catch {
    return null;
  }
}

export async function deleteView(id: string): Promise<boolean> {
  try {
    return await tauriInvoke<boolean>("delete_view", { id });
  } catch {
    return false;
  }
}
