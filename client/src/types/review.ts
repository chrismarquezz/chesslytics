import { type Square } from "chess.js";

export type BoardThemeKey = "modern" | "wood" | "aero" | "dusk" | "forest" | "ocean";

export type MoveSnapshot = {
  ply: number;
  moveNumber: number;
  san: string;
  color: "white" | "black";
  fen: string;
};

export type EngineScore = { type: "cp" | "mate"; value: number };

export type EngineLine = {
  move: string;
  score: EngineScore | null;
  pv: string[];
};

export type EngineEvaluation = {
  bestMove: string;
  score: EngineScore | null;
  depth: number;
  pv: string[];
  lines: EngineLine[];
};

export type MoveEvalState =
  | { status: "idle" }
  | { status: "loading"; previous?: EngineEvaluation }
  | { status: "success"; evaluation: EngineEvaluation }
  | { status: "error"; error: string };

export interface GameSummary {
  totalMoves: number;
  sampled: number;
  depth: number;
}

export interface EngineSample extends MoveSnapshot {
  evaluation: EngineEvaluation | null;
  error?: string;
}

export interface GameAnalysisResponse {
  summary: GameSummary;
  timeline: MoveSnapshot[];
  samples: EngineSample[];
}

export type Arrow = [Square, Square];
