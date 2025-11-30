import { Chess, type Square } from "chess.js";
import type {
  EngineLine,
  EngineSample,
  EngineScore,
  MoveEvalState,
  MoveQuality,
  MoveQualityLabel,
  MoveSnapshot,
} from "../types/review";

export const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

export function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (typeof err === "string" && err.trim()) {
    return err;
  }
  return fallback;
}

export function mergeSampleEvaluations(
  existing: Record<number, MoveEvalState>,
  samples: EngineSample[]
): Record<number, MoveEvalState> {
  const next = { ...existing };
  samples?.forEach((sample) => {
    if (sample.evaluation) {
      next[sample.ply] = { status: "success", evaluation: sample.evaluation };
    } else if (sample.error) {
      next[sample.ply] = { status: "error", error: sample.error };
    }
  });
  return next;
}

function extractClocksFromPgn(pgn: string): string[] {
  const regex = /\[%clk\s+([^\]]+)\]/gi;
  const clocks: string[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(pgn)) !== null) {
    clocks.push(match[1].trim());
  }
  return clocks;
}

export function buildTimelineFromPgn(pgn: string): MoveSnapshot[] {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    throw new Error("Invalid PGN format");
  }
  const verboseMoves = chess.history({ verbose: true });
  chess.reset();

  const snapshots: MoveSnapshot[] = [];
  const clockValues = extractClocksFromPgn(pgn);
  verboseMoves.forEach((move, index) => {
    chess.move(move);
    snapshots.push({
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      san: move.san,
      color: move.color === "w" ? "white" : "black",
      fen: chess.fen(),
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      clock: clockValues[index],
    });
  });
  return snapshots;
}

export function formatScore(score: EngineScore | null) {
  if (!score) return "—";
  if (score.type === "mate") {
    const mateMoves = Math.abs(score.value);
    return mateMoves === 0 ? "Checkmate" : `M${mateMoves}`;
  }
  const value = (score.value / 100).toFixed(2);
  return value.startsWith("-") ? value : `+${value}`;
}

export function formatBestMoveSan(bestMove?: string | null, fen?: string) {
  if (!bestMove || !UCI_MOVE_REGEX.test(bestMove)) return "—";
  try {
    const engine = fen ? new Chess(fen) : new Chess();
    const move = engine.move({
      from: bestMove.slice(0, 2) as Square,
      to: bestMove.slice(2, 4) as Square,
      promotion: bestMove[4],
    });
    return move?.san ?? bestMove;
  } catch {
    return bestMove;
  }
}

export function formatPvLines(pv: string[], fen?: string, maxMoves = Infinity): string[] {
  if (!pv.length) return [];
  const engine = fen ? new Chess(fen) : new Chess();
  const fenParts = fen?.split(" ");
  let turn: "w" | "b" = fenParts && fenParts[1] === "b" ? "b" : "w";
  let moveNumber = fenParts && fenParts[5] ? Number(fenParts[5]) || 1 : 1;
  const segments: string[] = [];
  let movesAdded = 0;

  for (const move of pv) {
    if (movesAdded >= maxMoves) break;
    if (!UCI_MOVE_REGEX.test(move)) break;
    const parsed = engine.move({
      from: move.slice(0, 2) as Square,
      to: move.slice(2, 4) as Square,
      promotion: move[4],
    });
    if (!parsed) break;

    const isWhiteMove = turn === "w";
    if (isWhiteMove) {
      segments.push(`${moveNumber}. ${parsed.san}`);
    } else if (segments.length) {
      segments[segments.length - 1] = `${segments[segments.length - 1]} ${parsed.san}`;
      moveNumber += 1;
    } else {
      segments.push(`${moveNumber}... ${parsed.san}`);
      moveNumber += 1;
    }
    turn = isWhiteMove ? "b" : "w";
    movesAdded += 1;
  }

  return segments.length ? [segments.join(" ")] : [];
}

export function formatLineContinuation(line: EngineLine, fen?: string): string {
  if (!line || !line.move || !UCI_MOVE_REGEX.test(line.move)) return "";
  try {
    const engine = fen ? new Chess(fen) : new Chess();
    const moved = engine.move({
      from: line.move.slice(0, 2) as Square,
      to: line.move.slice(2, 4) as Square,
      promotion: line.move[4],
    });
    if (!moved) return "";
    return formatPvLines(line.pv.slice(1), engine.fen(), 6)[0] ?? "";
  } catch {
    return "";
  }
}

export function getMateWinner(score: EngineScore | null, fen?: string): "White" | "Black" | undefined {
  if (!score || score.type !== "mate") return undefined;
  if (score.value > 0) return "White";
  if (score.value < 0) return "Black";
  const turn = fen?.split(" ")[1];
  if (turn === "w") return "Black";
  if (turn === "b") return "White";
  return undefined;
}

export function getEvalPercent(score: EngineScore | null, mateWinner?: "White" | "Black"): number {
  if (!score) return 0.5;
  if (score.type === "mate") {
    if (score.value > 0) return 1;
    if (score.value < 0) return 0;
    if (mateWinner === "White") return 1;
    if (mateWinner === "Black") return 0;
    return 0.5;
  }
  const cp = Math.max(-500, Math.min(500, score.value));
  return (cp + 500) / 1000;
}

export function describeAdvantage(
  percent: number,
  score?: EngineScore | null,
  mateWinner?: "White" | "Black",
): string {
  if (score?.type === "mate") {
    const winner = mateWinner ?? (score.value > 0 ? "White" : "Black");
    const moves = Math.abs(score.value);
    if (moves === 0) {
      return winner ? `${winner} wins by checkmate` : "Checkmate on the board";
    }
    const moveLabel = moves === 1 ? "move" : "moves";
    return `Checkmate in ${moves} ${moveLabel} for ${winner ?? "White"}`;
  }
  if (percent >= 0.8) return "Decisive advantage for White";
  if (percent >= 0.65) return "White pressing";
  if (percent <= 0.2) return "Decisive advantage for Black";
  if (percent <= 0.35) return "Black pressing";
  return "Roughly balanced";
}

export function scoreToCentipawns(score: EngineScore | null): number | null {
  if (!score) return null;
  if (score.type === "cp") return score.value;
  const mateSign = score.value >= 0 ? 1 : -1;
  return mateSign * 10000;
}

const MOVE_QUALITY_RULES: Array<{
  maxLoss: number;
  label: MoveQualityLabel;
  description: string;
}> = [
  { maxLoss: 20, label: "Best", description: "Top engine choice keeps the evaluation." },
  { maxLoss: 50, label: "Good", description: "Solid move with only a slight drop in evaluation." },
  { maxLoss: 99, label: "Inaccuracy", description: "A softer move that gives the opponent chances." },
  { maxLoss: 300, label: "Mistake", description: "Significant drop; the position worsens noticeably." },
  { maxLoss: Infinity, label: "Blunder", description: "Major error that swings the evaluation sharply." },
];

export function classifyMoveQuality({
  previousScore,
  currentScore,
  mover,
  previousFen,
  currentFen,
  forcedMove,
}: {
  previousScore: EngineScore | null;
  currentScore: EngineScore | null;
  mover: "white" | "black";
  previousFen?: string;
  currentFen?: string;
  forcedMove?: boolean;
}): MoveQuality | null {
  if (forcedMove) {
    return {
      label: "Forced",
      loss: 0,
      description: "Only legal move available in the position.",
    };
  }

  if (!currentScore) return null;

  const moverLabel = mover === "white" ? "White" : "Black";
  const opponentLabel = moverLabel === "White" ? "Black" : "White";
  const prevCpScore = scoreToCentipawns(previousScore);
  const currCpScore = scoreToCentipawns(currentScore);
  const previousMateWinner =
    previousScore?.type === "mate" ? getMateWinner(previousScore, previousFen) : undefined;
  const currentMateWinner =
    currentScore?.type === "mate" ? getMateWinner(currentScore, currentFen) : undefined;

  if (previousMateWinner === moverLabel && currentMateWinner !== moverLabel) {
    if (currentMateWinner === opponentLabel) {
      return {
        label: "Blunder",
        loss: Infinity,
        description: "Turns a winning mate into a forced mate for the opponent.",
      };
    }
    if (currentScore.type !== "mate" || !currentMateWinner) {
      return {
        label: "Miss",
        loss: Infinity,
        description: "Misses a forced mate opportunity.",
      };
    }
  }


  if (currentScore.type === "mate") {
    if (currentScore.value === 0) {
      const mateWinner = getMateWinner(currentScore, currentFen);
      if (mateWinner === moverLabel) {
        return {
          label: "Best",
          loss: 0,
          description: "Clinical conversion: delivers checkmate.",
        };
      }
      return {
        label: "Blunder",
        loss: Infinity,
        description: "Allows checkmate on the board.",
      };
    }

    if (!currentMateWinner) return null;

    if (currentMateWinner === moverLabel) {
      return {
        label: "Best",
        loss: 0,
        description: "Keeps the forced mate sequence on track.",
      };
    }

    if (previousMateWinner === currentMateWinner) {
      return {
        label: "Good",
        loss: 0,
        description: "Forced mate already on board; no better defense exists.",
      };
    }

    if (currentMateWinner === opponentLabel) {
      return {
        label: "Blunder",
        loss: Infinity,
        description: "Allows a forced mate to appear on the board.",
      };
    }
    return null;
  }

  const prevCp = prevCpScore;
  const currCp = currCpScore;
  if (prevCp == null || currCp == null) return null;
  const factor = mover === "white" ? 1 : -1;
  const prevPerspective = prevCp * factor;
  const currPerspective = currCp * factor;
  const loss = Math.max(0, prevPerspective - currPerspective);
  const rule = MOVE_QUALITY_RULES.find((r) => loss <= r.maxLoss);
  if (!rule) return null;
  return {
    label: rule.label,
    loss,
    description: rule.description,
  };
}
