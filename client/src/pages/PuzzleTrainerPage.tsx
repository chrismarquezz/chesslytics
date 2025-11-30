import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import Navbar from "../components/Navbar";
import EvaluationBar from "../components/review/EvaluationBar";
import { useUser } from "../context/UserContext";
import type { EngineEvaluation, MoveSnapshot, EngineScore, BoardThemeKey } from "../types/review";
import { buildTimelineFromPgn, formatScore, formatPvLines, getEvalPercent, getMateWinner, mergeSampleEvaluations, scoreToCentipawns } from "../utils/reviewEngine";
import { Settings, Clock3 } from "lucide-react";
import ThemeSelectorModal from "../components/review/ThemeSelectorModal";
import type { GameAnalysisResponse } from "../types/review";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:5100";
const BOARD_THEMES: Record<
  BoardThemeKey,
  {
    light: string;
    dark: string;
    label: string;
  }
> = {
  modern: { light: "#f2f2f2", dark: "#777777", label: "Modern" },
  wood: { light: "#ede0c8", dark: "#b58863", label: "Wood" },
  aero: { light: "#dce3ea", dark: "#6b829c", label: "Aero" },
  dusk: { light: "#e4e9f2", dark: "#374151", label: "Dusk" },
  forest: { light: "#e2f0d9", dark: "#779556", label: "Forest" },
  ocean: { light: "#e8f5ff", dark: "#2b6ca3", label: "Ocean" },
  sunset: { light: "#fce8d5", dark: "#d47455", label: "Sunset" },
  midnight: { light: "#cbd5e1", dark: "#1f2937", label: "Midnight" },
  rose: { light: "#fce7f3", dark: "#be185d", label: "Rose" },
  ember: { light: "#ffe5d3", dark: "#e4572e", label: "Ember" },
  cobalt: { light: "#e3ecff", dark: "#1e3a8a", label: "Cobalt" },
  moss: { light: "#e8f0df", dark: "#5b6b2f", label: "Moss" },
};

type Puzzle = {
  fen: string;
  bestMove: string;
  playedMove: string;
  mover: "white" | "black";
  moveNumber: number;
  description: string;
  gameMeta: {
    white: string;
    whiteRating?: number;
    black: string;
    blackRating?: number;
    timeControl?: string;
    date?: number | null;
  };
  timeSpentLabel: string;
  score: EngineScore | null;
  playedScore: EngineScore | null;
};

const getPuzzleCacheKey = (username?: string | null) =>
  username ? `puzzles:${username.toLowerCase().trim()}` : null;

function parseClockToSeconds(clock?: string | null): number | null {
  if (!clock) return null;
  const parts = clock.split(":").map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  return null;
}

function formatTimeSpent(seconds: number | null): string {
  if (seconds == null) return "Unknown";
  if (seconds < 1) return "< 1s";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatTimeControlLabel(raw: string | null | undefined) {
  if (!raw) return null;
  if (raw.includes("/")) return raw; // uncommon formats, show raw
  const [basePart, incPart = "0"] = raw.split("+");
  const baseSeconds = Number(basePart);
  const incSeconds = Number(incPart);
  if (!Number.isFinite(baseSeconds)) return raw;
  const minutes = baseSeconds / 60;
  const baseLabel =
    baseSeconds % 60 === 0
      ? `${minutes}`
      : minutes >= 1
        ? `${parseFloat(minutes.toFixed(1)).toString()}`
        : `${parseFloat(minutes.toFixed(2))}`;
  const incLabel = Number.isFinite(incSeconds) ? `${incSeconds}` : incPart;
  return `${baseLabel}+${incLabel}`;
}

function formatTimeControlSafe(raw?: string | null) {
  return formatTimeControlLabel(raw ?? null);
}

function formatDateFromEpoch(epochSeconds?: number | null) {
  if (!epochSeconds) return null;
  const d = new Date(epochSeconds * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildWhatHappenedText(prevScore: number | null, currScore: number | null, mover: "white" | "black") {
  if (prevScore == null || currScore == null) return "Evaluation swung here.";
  const drop = mover === "white" ? prevScore - currScore : currScore - prevScore;
  if (Math.abs(drop) > 600) {
    if (Math.abs(prevScore) < 150) return "It was equal but you blundered the game.";
    return "You were dominating but slipped up.";
  }
  if (Math.abs(drop) > 250) return "You let the advantage slip in this move.";
  return "A small mistake, but it changed the evaluation.";
}

function deriveTimeSpent(current: MoveSnapshot, timeline: MoveSnapshot[]): string {
  const idx = timeline.findIndex((m) => m.ply === current.ply);
  if (idx <= 0) return "Unknown";
  let previousSameColor: MoveSnapshot | null = null;
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (timeline[i].color === current.color) {
      previousSameColor = timeline[i];
      break;
    }
  }
  if (!previousSameColor) return "Unknown";
  const prevClock = parseClockToSeconds(previousSameColor.clock);
  const currClock = parseClockToSeconds(current.clock);
  if (prevClock == null || currClock == null) return "Unknown";
  const delta = Math.max(0, prevClock - currClock);
  const rounded = Math.round(delta);
  return formatTimeSpent(rounded);
}

export default function PuzzleTrainerPage() {
  const { games, profile, username } = useUser();
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardPosition, setBoardPosition] = useState<string>("start");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [solutionShown, setSolutionShown] = useState(false);
  const [solved, setSolved] = useState(false);
  const [attemptedWrong, setAttemptedWrong] = useState(false);
  const [boardWidth, setBoardWidth] = useState(820);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const [, setStatusMessage] = useState<string>("");
  const [wrongSquare, setWrongSquare] = useState<string | null>(null);
  const [correctSquare, setCorrectSquare] = useState<string | null>(null);
  const [puzzleResults, setPuzzleResults] = useState<Array<boolean | null>>([]);
  const prevPuzzleCountRef = useRef(0);
  const [liveEvaluation, setLiveEvaluation] = useState<EngineEvaluation | null>(null);
  const [engineStatus, setEngineStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const evalSourceRef = useRef<EventSource | null>(null);
  const wrongTimeoutRef = useRef<number | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);
  const [solvedFen, setSolvedFen] = useState<string | null>(null);
  const pieceAssets = useMemo(() => {
    const glob = import.meta.glob("../assets/pieces/*/*.svg", { eager: true, import: "default" });
    const map: Record<string, Record<string, string>> = {};
    Object.entries(glob).forEach(([path, mod]) => {
      const parts = path.split("/");
      const setName = parts[parts.length - 2];
      const file = parts[parts.length - 1].replace(".svg", "");
      if (!map[setName]) map[setName] = {};
      map[setName][file] = mod as string;
    });
    return map;
  }, []);
  const pieceFolders = useMemo(() => Object.keys(pieceAssets).sort(), [pieceAssets]);
  const piecePreviews = useMemo(
    () =>
      pieceFolders.reduce<Record<string, { white?: string; black?: string }>>((acc, key) => {
        acc[key] = { white: pieceAssets[key]?.wK, black: pieceAssets[key]?.bK };
        return acc;
      }, {}),
    [pieceAssets, pieceFolders]
  );
  const [pieceTheme, setPieceTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("chesslab-piece-theme");
      if (stored) return stored;
    }
    return pieceFolders.includes("cburnett") ? "cburnett" : pieceFolders[0] ?? "merida_new";
  });
  const pieceOptions = useMemo(
    () => Array.from(new Set([...(pieceFolders.length ? pieceFolders : ["modern"]), pieceTheme])),
    [pieceFolders, pieceTheme]
  );
  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("chesslab-theme");
      if (stored && stored in BOARD_THEMES) return stored as BoardThemeKey;
    }
    return "modern";
  });
  const [engineLinesCount, setEngineLinesCount] = useState(3);
  const customPieces = useMemo(() => {
    const set = pieceAssets[pieceTheme] || {};
    return Object.fromEntries(
      ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"].map((code) => [
        code,
        (props: { squareWidth: number }) => (
          <img
            src={set[code] || ""}
            alt={code}
            className="w-full h-full"
            style={{ width: props.squareWidth, height: props.squareWidth }}
          />
        ),
      ])
    );
  }, [pieceAssets, pieceTheme]);

  const currentPuzzle = puzzles[currentIndex];

  const loadPuzzles = useCallback(async () => {
    if (!games.length) return;
    const gamesWithPgn = games.filter((g) => g?.pgn);
    if (!gamesWithPgn.length) return;

    setLoading(true);
    setError(null);

    const allPuzzles: Puzzle[] = [];
    const seenKeys = new Set<string>();
    const userLower = username?.toLowerCase?.().trim() ?? "";

    const pushPuzzle = (p: Puzzle) => {
      const key = `${p.fen}-${p.moveNumber}-${p.playedMove}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      allPuzzles.push(p);
      setPuzzles((prev) => {
        const exists = prev.some((item) => `${item.fen}-${item.moveNumber}-${item.playedMove}` === key);
        if (exists) return prev;
        return [...prev, p];
      });
    };

    const processGame = async (game: any) => {
      const isUserWhite = game.white?.username?.toLowerCase?.() === userLower;
      const isUserBlack = game.black?.username?.toLowerCase?.() === userLower;
      if (!isUserWhite && !isUserBlack) return;

      const response = await fetch(`${API_BASE_URL}/api/review/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pgn: game.pgn, opening: null }),
      });
      if (!response.ok) return;

      const payload = (await response.json()) as GameAnalysisResponse;
      const evals = mergeSampleEvaluations({}, payload.samples ?? []);
      const timeline = buildTimelineFromPgn(game.pgn);

      timeline.forEach((move, idx) => {
        const userMover = move.color === "white" ? isUserWhite : isUserBlack;
        if (!userMover) return;

        const prev = idx > 0 ? timeline[idx - 1] : null;
        if (!prev) return;

        const prevEval = (evals[prev.ply] as { status?: string; evaluation?: EngineEvaluation })?.evaluation;
        const currEval = (evals[move.ply] as { status?: string; evaluation?: EngineEvaluation })?.evaluation;
        if (!prevEval || !currEval || !prevEval.score || !currEval.score) return;

        const chessAfter = new Chess(move.fen);
        if (chessAfter.isCheckmate()) return;

        const prevCp = scoreToCentipawns(prevEval.score);
        const currCp = scoreToCentipawns(currEval.score);
        const mover = move.color;
        const loss = prevCp != null && currCp != null ? (mover === "white" ? prevCp - currCp : currCp - prevCp) : null;

        const prevMateWinner = prevEval.score.type === "mate" ? getMateWinner(prevEval.score, prev.fen) : null;
        const currMateWinner = currEval.score.type === "mate" ? getMateWinner(currEval.score, move.fen) : null;
        if (currMateWinner === (mover === "white" ? "White" : "Black")) return; // delivering mate is not a blunder
        const isMateBlunder =
          prevMateWinner === (mover === "white" ? "White" : "Black") &&
          currMateWinner !== prevMateWinner;
        const isMateMiss =
          prevMateWinner === (mover === "white" ? "White" : "Black") &&
          currMateWinner === null;

        const startingAdvantage =
          prevEval.score.type === "mate"
            ? prevMateWinner === (mover === "white" ? "White" : "Black")
              ? Infinity
              : prevMateWinner === null
                ? 0
                : -Infinity
            : prevCp != null
              ? mover === "white"
                ? prevCp
                : -prevCp
              : null;

        if (startingAdvantage != null && startingAdvantage < -50) return; // only keep if at least drawing or better

        if (!isMateBlunder && !isMateMiss && (loss == null || loss < 200)) return;
        if (!prevEval.bestMove) return;
        const playedUci = (move.uci ?? "").toLowerCase();
        const bestUci = prevEval.bestMove.toLowerCase();
        if (bestUci.slice(0, 4) === playedUci.slice(0, 4)) return;

        const description = buildWhatHappenedText(prevCp, currCp, mover);
        const timeSpentLabel = deriveTimeSpent(move, timeline);

        pushPuzzle({
          fen: prev.fen,
          bestMove: prevEval.bestMove,
          playedMove: move.uci ?? "",
          mover: move.color,
          moveNumber: move.moveNumber,
          description,
          timeSpentLabel,
          score: prevEval.score ?? null,
          playedScore: currEval.score ?? null,
          gameMeta: {
            white: game.white?.username ?? "White",
            whiteRating: game.white?.rating,
            black: game.black?.username ?? "Black",
            blackRating: game.black?.rating,
            timeControl: game.time_control,
            date: game.end_time ?? null,
          },
        });
      });
    };

    try {
      let processedIndex = 0;

      for (; processedIndex < gamesWithPgn.length; processedIndex += 1) {
        await processGame(gamesWithPgn[processedIndex]);
        if (allPuzzles.length >= 2) {
          processedIndex += 1;
          break;
        }
      }

      setPuzzles((prev) => {
        const seen = new Set(prev.map((p) => `${p.fen}-${p.moveNumber}-${p.playedMove}`));
        const merged = [...prev];
        allPuzzles.forEach((p) => {
          const key = `${p.fen}-${p.moveNumber}-${p.playedMove}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(p);
          }
        });
        return merged;
      });
      setCurrentIndex((prev) => (prev < 0 && allPuzzles.length ? 0 : prev));
      if (!puzzles.length && allPuzzles.length) {
        setBoardPosition(allPuzzles[0].fen);
        setHintShown(false);
        setSolutionShown(false);
        setSolved(false);
        setStatusMessage("");
      }
      setLoading(false);

      (async () => {
        for (let i = processedIndex; i < gamesWithPgn.length; i += 1) {
          await processGame(gamesWithPgn[i]);
        }
        setPuzzles((prev) => {
          const existing = new Set(prev.map((p) => `${p.fen}-${p.moveNumber}-${p.playedMove}`));
          const extras = allPuzzles.filter((p) => !existing.has(`${p.fen}-${p.moveNumber}-${p.playedMove}`));
          if (!extras.length) return prev;
          return [...prev, ...extras];
        });
      })().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load puzzles");
      setLoading(false);
    }
  }, [games, puzzles.length, username]);

  useEffect(() => {
    if (hydratedFromCache) {
      void loadPuzzles();
    }
  }, [hydratedFromCache, loadPuzzles]);

  useEffect(() => {
    const key = getPuzzleCacheKey(username);
    if (!key || puzzles.length === 0) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(puzzles));
    } catch {
      // ignore storage errors
    }
  }, [puzzles, username]);

  useEffect(() => {
    const key = getPuzzleCacheKey(username);
    if (!key) {
      setHydratedFromCache(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const cached = JSON.parse(raw) as Puzzle[];
        if (Array.isArray(cached) && cached.length) {
          setPuzzles(cached);
          setCurrentIndex(0);
          setBoardPosition(cached[0].fen);
          setPuzzleResults(Array(cached.length).fill(null));
        }
      }
    } catch {
      // ignore parse/storage errors
    } finally {
      setHydratedFromCache(true);
    }
  }, [username]);

  useEffect(() => {
    setPuzzleResults((prev) => {
      if (prev.length >= puzzles.length) return prev;
      const next = [...prev];
      while (next.length < puzzles.length) next.push(null);
      return next;
    });
    const prevCount = prevPuzzleCountRef.current;
    if (puzzles.length > prevCount) {
      const wasAtEnd = currentIndex === prevCount - 1;
      if (wasAtEnd && solved) {
        setCurrentIndex(prevCount); // jump to first newly added puzzle
      }
    }
    prevPuzzleCountRef.current = puzzles.length;
  }, [currentIndex, puzzles.length, solved]);

  useEffect(() => {
    if (currentPuzzle) {
      setBoardPosition(currentPuzzle.fen);
      setHintShown(false);
      setSolutionShown(false);
      setSolved(false);
      setStatusMessage("");
      setWrongSquare(null);
      setCorrectSquare(null);
      setAttemptedWrong(false);
      setSolvedFen(null);
      setLiveEvaluation(null);
      setEngineStatus("idle");
      if (evalSourceRef.current) {
        evalSourceRef.current.close();
        evalSourceRef.current = null;
      }
      if (wrongTimeoutRef.current) {
        window.clearTimeout(wrongTimeoutRef.current);
        wrongTimeoutRef.current = null;
      }
    }
  }, [currentPuzzle]);

  const handleMove = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (!currentPuzzle || (solved)) return false;
      const chess = new Chess(boardPosition);
      const result = chess.move({ from: sourceSquare as any, to: targetSquare as any, promotion: "q" });
      if (!result) return false;
      const moveUci = `${sourceSquare}${targetSquare}${result.promotion ?? ""}`.toLowerCase();
      const best = currentPuzzle.bestMove.toLowerCase();
      const bestBase = best.slice(0, 4);
      const moveBase = moveUci.slice(0, 4);
      if (bestBase === moveBase || best === moveUci) {
        setSolved(true);
        setStatusMessage("Correct! You found the best move.");
        setBoardPosition(chess.fen());
        setCorrectSquare(targetSquare);
        setSolvedFen(chess.fen());
        setWrongSquare(null);
        setPuzzleResults((prev) => {
          const next = [...prev];
          next[currentIndex] = !attemptedWrong;
          return next;
        });
        if (wrongTimeoutRef.current) {
          window.clearTimeout(wrongTimeoutRef.current);
          wrongTimeoutRef.current = null;
        }
        return true;
      }
      setBoardPosition(chess.fen());
      setWrongSquare(targetSquare);
      setPuzzleResults((prev) => {
        const next = [...prev];
        if (next[currentIndex] === null) {
          next[currentIndex] = false;
        }
        return next;
      });
      setAttemptedWrong(true);
      if (wrongTimeoutRef.current) {
        window.clearTimeout(wrongTimeoutRef.current);
      }
      wrongTimeoutRef.current = window.setTimeout(() => {
        setBoardPosition(currentPuzzle.fen);
        setWrongSquare(null);
        setSelectedSquare(null);
      }, 2000);
      setStatusMessage("Try again.");
      return true;
    },
    [attemptedWrong, boardPosition, currentIndex, currentPuzzle, solved]
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!currentPuzzle || (solved)) return;
      setStatusMessage("");
      const chess = new Chess(boardPosition);
      const piece = chess.get(square as Square);
      const isTurn = piece && piece.color === chess.turn();

      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null);
          return;
        }
        if (isTurn) {
          setSelectedSquare(square);
          return;
        }
        const moved = handleMove(selectedSquare, square);
        if (moved) {
          setSelectedSquare(null);
          return;
        }
        setSelectedSquare(null);
        return;
      }

      if (isTurn) {
        setSelectedSquare(square);
        return;
      }
      const moves = chess.moves({ square: square as Square, verbose: true });
      if (moves.length) {
        setSelectedSquare(square);
      }
    },
    [boardPosition, currentPuzzle, handleMove, selectedSquare, solved]
  );

  const handleSquareDrop = useCallback(
    (from: string, to: string) => {
      if (solved) return false;
      const moved = handleMove(from, to);
      if (moved) setSelectedSquare(null);
      return moved;
    },
    [handleMove, solved]
  );

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "#f8e7a1" };
    }
    if (wrongSquare) {
      styles[wrongSquare] = { ...(styles[wrongSquare] || {}), backgroundColor: "#fca5a5" };
    }
    if (correctSquare) {
      styles[correctSquare] = { ...(styles[correctSquare] || {}), backgroundColor: "#bbf7d0" };
    }
    if (currentPuzzle && (hintShown || solutionShown)) {
      const from = currentPuzzle.bestMove.slice(0, 2);
      styles[from] = { ...(styles[from] || {}), backgroundColor: "#fde68a" };
    }
    return styles;
  }, [correctSquare, currentPuzzle, hintShown, solutionShown, selectedSquare, wrongSquare]);

  const solutionArrows = useMemo(() => {
    const arrows: Array<[any, any, string?]> = [];
    if (currentPuzzle?.playedMove && !solved && !wrongSquare) {
      arrows.push([
        currentPuzzle.playedMove.slice(0, 2),
        currentPuzzle.playedMove.slice(2, 4),
        "#ef4444",
      ]);
    }
    if (currentPuzzle && solutionShown) {
      arrows.push([
        currentPuzzle.bestMove.slice(0, 2),
        currentPuzzle.bestMove.slice(2, 4),
        "#22c55e",
      ]);
    }
    return arrows;
  }, [currentPuzzle, solutionShown, solved, wrongSquare]);

  const orientation = currentPuzzle?.mover === "black" ? "black" : "white";
  const activeEvaluationScore = liveEvaluation?.score ?? currentPuzzle?.score ?? null;
  const activeEvalMateWinner = activeEvaluationScore ? getMateWinner(activeEvaluationScore, boardPosition) : undefined;
  const evalPercent = activeEvaluationScore ? getEvalPercent(activeEvaluationScore, activeEvalMateWinner) : 0.5;
  const moverLabel = currentPuzzle?.mover ? `${currentPuzzle.mover.charAt(0).toUpperCase()}${currentPuzzle.mover.slice(1)}` : "Side";
  const boardColors = BOARD_THEMES[boardTheme] ?? BOARD_THEMES.modern;

  useEffect(() => {
    const resizeBoard = () => {
      const container = boardContainerRef.current;
      if (!container) return;
      const width = container.clientWidth;
      const next = Math.max(600, Math.min(width, 1200));
      setBoardWidth(next);
    };
    resizeBoard();
    window.addEventListener("resize", resizeBoard);
    return () => window.removeEventListener("resize", resizeBoard);
  }, []);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setIsThemeModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!solved || !boardPosition) {
      if (evalSourceRef.current) {
        evalSourceRef.current.close();
        evalSourceRef.current = null;
      }
      setLiveEvaluation(null);
      setEngineStatus("idle");
      return;
    }
    if (evalSourceRef.current) {
      evalSourceRef.current.close();
      evalSourceRef.current = null;
    }
    setEngineStatus("loading");
    const url = `${API_BASE_URL}/api/review/evaluate/stream?fen=${encodeURIComponent(boardPosition)}&depth=22&lines=${engineLinesCount}`;
    const source = new EventSource(url);
    evalSourceRef.current = source;
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { evaluation?: EngineEvaluation; done?: boolean; error?: string };
        if (payload.error) {
          setEngineStatus("error");
          source.close();
          evalSourceRef.current = null;
          return;
        }
        if (payload.evaluation) {
          setLiveEvaluation(payload.evaluation);
          setEngineStatus("success");
        }
        if (payload.done) {
          source.close();
          evalSourceRef.current = null;
        }
      } catch {
        // ignore malformed
      }
    };
    source.onerror = () => {
      setEngineStatus("error");
      source.close();
      evalSourceRef.current = null;
    };
    return () => {
      source.close();
      evalSourceRef.current = null;
    };
  }, [API_BASE_URL, boardPosition, engineLinesCount, solved]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-12">
      <div className="fixed top-0 left-0 right-0 h-8 bg-[#00bfa6] z-40" />
      <Navbar avatarUrl={profile?.avatar ?? null} username={profile?.username ?? username} belowTopBar />
      <div className="w-full px-6 pt-8 pl-24 md:pl-50">

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
        {!loading && puzzles.length === 0 && !error && (
          <div className="text-sm text-gray-600">No puzzles found yet. Run an analysis to generate blunders.</div>
        )}

        {currentPuzzle && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow pt-4 pr-4 w-[80vw]">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(600px,_1.6fr)_minmax(360px,_0.8fr)] gap-10 items-start">
              <div className="relative flex flex-col gap-4 p-4">
                <div
                  ref={boardContainerRef}
                  className="flex flex-col gap-3"
                  style={{ width: `${boardWidth}px` }}
                >
                  <div style={{ width: `${boardWidth}px` }}>
                    <EvaluationBar
                      evaluationPercent={evalPercent}
                      currentEvaluationScore={activeEvaluationScore}
                      whiteLabel=""
                      blackLabel=""
                      disabled={!solved}
                      disabledMessage={`${moverLabel} to move`}
                    />
                  </div>
                  <div style={{ pointerEvents: solved ? "none" : "auto" }}>
                    <Chessboard
                      position={boardPosition}
                      boardOrientation={orientation}
                      arePiecesDraggable={!solved}
                      onPieceDrop={!solved ? handleSquareDrop : undefined}
                      onSquareClick={!solved ? handleSquareClick : undefined}
                      customBoardStyle={{ borderRadius: 0 }}
                      customSquareStyles={customSquareStyles}
                      customDarkSquareStyle={{ backgroundColor: boardColors.dark }}
                      customLightSquareStyle={{ backgroundColor: boardColors.light }}
                      customArrows={solutionArrows}
                      customPieces={customPieces}
                      boardWidth={boardWidth}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-end mt-0" style={{ width: `${boardWidth}px` }}>
                  <div className="relative group/settings">
                    <button
                      onClick={() => setIsThemeModalOpen((prev: boolean) => !prev)}
                      className="h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-700 shadow hover:bg-gray-50 flex items-center justify-center"
                      aria-label="Settings"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-9 px-2 py-1 text-xs font-semibold text-white bg-gray-900 rounded-md opacity-0 group-hover/settings:opacity-90 transition-opacity text-center whitespace-nowrap shadow">
                      Settings
                    </span>
                  </div>
                  <button
                    onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, puzzles.length - 1))}
                    disabled={!solved || currentIndex === puzzles.length - 1}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#00bfa6] text-white shadow disabled:opacity-60"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">What happened</p>
                  <p className="text-sm text-gray-900 mt-2">{currentPuzzle.description}</p>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setHintShown(true)}
                    className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 w-full"
                  >
                    Hint
                  </button>
                  <button
                    onClick={() => {
                      setHintShown(true);
                      setSolutionShown(true);
                    }}
                    className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 w-full"
                  >
                    Solution
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-900">Move {currentPuzzle.moveNumber}</p>
                    <div className="space-y-2 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-gray-300 bg-white" />
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <span className="font-semibold">{currentPuzzle.gameMeta.white}</span>
                          {currentPuzzle.gameMeta.whiteRating ? (
                            <span className="text-gray-600">{currentPuzzle.gameMeta.whiteRating}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-gray-900" />
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <span className="font-semibold">{currentPuzzle.gameMeta.black}</span>
                          {currentPuzzle.gameMeta.blackRating ? (
                            <span className="text-gray-600">{currentPuzzle.gameMeta.blackRating}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="h-px bg-gray-200/70" />
                    <div className="text-xs text-gray-600 flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-gray-500" />
                      <span>{formatTimeControlSafe(currentPuzzle.gameMeta.timeControl) ?? "—"}</span>
                      {formatDateFromEpoch(currentPuzzle.gameMeta.date) ? (
                        <span className="ml-2 text-gray-500">· {formatDateFromEpoch(currentPuzzle.gameMeta.date)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 shadow p-4 flex flex-col">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-700">Move time</p>
                      <div className="relative group/movetime translate-y-[-2px]">
                        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full border border-gray-300 text-[10px] font-semibold text-gray-600 bg-white leading-none">
                          i
                        </span>
                        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 text-xs font-semibold text-white bg-gray-900 rounded-md opacity-0 group-hover/movetime:opacity-90 transition-opacity text-center whitespace-nowrap shadow">
                          Time taken for the original move in the game
                        </span>
                      </div>
                    </div>
                    <div className="h-px bg-gray-200/70 mt-2 mb-2" />
                    <p className="text-2xl font-bold text-[#00bfa6] mt-4 text-center">{currentPuzzle.timeSpentLabel}</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 shadow p-4 flex flex-col gap-3 sm:col-span-2">
                  <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                    <span>Progress</span>
                    <span className="text-[#00bfa6]">
                      {puzzles.length ? currentIndex + 1 : 0}/{puzzles.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-10 gap-1 max-h-28 overflow-y-auto pr-1">
                    {puzzleResults.map((res, idx) => (
                      <div
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`aspect-square rounded cursor-pointer ${res === null ? "bg-gray-100 border border-dashed border-gray-200" : res ? "bg-[#00bfa6]" : "bg-red-500"}`}
                        title={`Puzzle ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 shadow p-4 flex flex-col gap-3 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Evaluation</p>
                  </div>
                  {solved ? (
                    <div className="space-y-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Eval:</span>
                        <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200 font-semibold">
                          {formatScore(liveEvaluation?.score ?? null)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-gray-600 text-xs uppercase">Top line</div>
                        <div className="px-2 py-2 rounded-lg border border-gray-200 bg-gray-50 font-mono text-xs">
                          {formatPvLines(liveEvaluation?.pv ?? [], boardPosition, 12).join(" ")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Original eval:</span>
                        <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200 font-semibold">
                          {formatScore(currentPuzzle.playedScore ?? null)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-gray-600 text-xs uppercase">PV</div>
                        <div className="px-2 py-2 rounded-lg border border-gray-200 bg-gray-50 font-mono text-xs">
                          {formatPvLines(currentPuzzle.playedScore?.pv ?? [], currentPuzzle.fen, 12).join(" ")}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ThemeSelectorModal
        open={isThemeModalOpen}
        themes={BOARD_THEMES}
        selectedKey={boardTheme}
        onSelect={(key) => {
          setBoardTheme(key as BoardThemeKey);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("chesslab-theme", key);
          }
        }}
        pvCount={engineLinesCount}
        onChangePvCount={(value) => setEngineLinesCount(value)}
        pieceTheme={pieceTheme}
        pieceOptions={pieceOptions}
        piecePreviews={piecePreviews}
        onSelectPiece={(key) => {
          const next = key || "modern";
          setPieceTheme(next);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("chesslab-piece-theme", next);
          }
        }}
        onClose={() => setIsThemeModalOpen(false)}
        hideEngineTab
      />
    </div>
  );
}
