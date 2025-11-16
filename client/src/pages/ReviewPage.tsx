import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import Navbar from "../components/Navbar";
import GameInputCard from "../components/review/GameInputCard";
import ThemeSelectorModal from "../components/review/ThemeSelectorModal";
import GameReviewHeader from "../components/review/GameReviewHeader";
import BoardAnalysisCard from "../components/review/BoardAnalysisCard";
import MoveListCard, { type MovePair } from "../components/review/MoveListCard";
import EngineAnalysisCard from "../components/review/EngineAnalysisCard";
import type {
  BoardThemeKey,
  EngineEvaluation,
  EngineScore,
  GameAnalysisResponse,
  MoveEvalState,
  MoveSnapshot,
} from "../types/review";
import {
  UCI_MOVE_REGEX,
  buildTimelineFromPgn,
  describeAdvantage,
  getErrorMessage,
  getEvalPercent,
  getMateWinner,
  mergeSampleEvaluations,
} from "../utils/reviewEngine";

type View = "analysis" | "timeline" | "insights";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:5100";
const REVIEW_STORAGE_KEY = "chesslytics-review-state";

interface PersistedReviewState {
  pgnInput: string;
  timeline: MoveSnapshot[];
  moveEvaluations: Record<number, MoveEvalState>;
  currentMoveIndex: number;
  analysisReady: boolean;
  lastEvaluationDisplay: { evaluation: EngineEvaluation; fen?: string } | null;
  boardOrientation: "white" | "black";
  showBestMoveArrow: boolean;
}
const SAMPLE_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.01.15"]
[Round "-"]
[White "SamplePlayer"]
[Black "Opponent"]
[Result "0-1"]

1. d4 d5 2. Nc3 Nf6 3. Bf4 c6 4. e3 Bf5 5. f3 e6 6. g4 Bg6 7. h4 h5 8. g5 Nfd7
9. Bd3 Bxd3 10. Qxd3 c5 11. g6 c4 12. gxf7+ Kxf7 13. Qf1 Nc6 14. O-O-O Qa5
15. e4 Bb4 16. Nge2 Rhf8 17. Rg1 Nxd4 18. Rxd4 e5 19. Rxd5 Qc7 20. Bg5 Nb6
21. Rd1 a5 22. Nd5 Nxd5 23. Rxd5 c3 24. b3 a4 25. Rb5 axb3 26. cxb3 Rxa2
27. Kb1 Rfa8 28. Qg2 Rb2+ 29. Kc1 Ra1# 0-1`;

export default function ReviewPage() {
  const [pgnInput, setPgnInput] = useState("");
  const [selectedView, setSelectedView] = useState<View>("analysis");
  const [timeline, setTimeline] = useState<MoveSnapshot[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [moveEvaluations, setMoveEvaluations] = useState<Record<number, MoveEvalState>>({});
  const [lastEvaluationDisplay, setLastEvaluationDisplay] = useState<{
    evaluation: EngineEvaluation;
    fen?: string;
  } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analysisKey, setAnalysisKey] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [boardSize, setBoardSize] = useState(640);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("chesslytics-theme") as BoardThemeKey | null;
      if (stored && stored in BOARD_THEMES) {
        return stored;
      }
    }
    return "modern";
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const initialFen = useMemo(() => new Chess().fen(), []);
  const startingSnapshot = useMemo<MoveSnapshot>(
    () => ({
      ply: 0,
      moveNumber: 0,
      san: "start",
      color: "white",
      fen: initialFen,
    }),
    [initialFen]
  );

  useEffect(() => {
    const resizeBoard = () => {
      if (typeof window === "undefined") return;
      const width = window.innerWidth;
      setBoardSize(Math.max(360, Math.min(720, width - 160)));
    };
    resizeBoard();
    window.addEventListener("resize", resizeBoard);
    return () => window.removeEventListener("resize", resizeBoard);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("chesslytics-theme", boardTheme);
  }, [boardTheme]);

  useEffect(() => {
    if (!timeline.length) {
      setIsAutoPlaying(false);
    }
  }, [timeline.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as PersistedReviewState;
      setPgnInput(stored.pgnInput ?? "");
      setTimeline(stored.timeline ?? []);
      setMoveEvaluations(stored.moveEvaluations ?? {});
      setCurrentMoveIndex(stored.currentMoveIndex ?? -1);
      setAnalysisReady(Boolean(stored.analysisReady && stored.timeline?.length));
      setLastEvaluationDisplay(stored.lastEvaluationDisplay ?? null);
      setBoardOrientation(stored.boardOrientation ?? "white");
      setShowBestMoveArrow(stored.showBestMoveArrow ?? true);
      if (stored.analysisReady && stored.timeline?.length) {
        setAnalysisKey((prev) => prev + 1);
      }
    } catch {
      window.localStorage.removeItem(REVIEW_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!analysisReady && !timeline.length && !pgnInput) {
      window.localStorage.removeItem(REVIEW_STORAGE_KEY);
      return;
    }
    const payload: PersistedReviewState = {
      pgnInput,
      timeline,
      moveEvaluations,
      currentMoveIndex,
      analysisReady,
      lastEvaluationDisplay,
      boardOrientation,
      showBestMoveArrow,
    };
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(payload));
  }, [
    analysisReady,
    timeline,
    moveEvaluations,
    currentMoveIndex,
    lastEvaluationDisplay,
    boardOrientation,
    showBestMoveArrow,
    pgnInput,
  ]);


  const boardPosition =
    currentMoveIndex >= 0 && timeline[currentMoveIndex] ? timeline[currentMoveIndex].fen : initialFen;

  const movePairs = useMemo<MovePair[]>(() => {
    const pairs: MovePair[] = [];
    for (let i = 0; i < timeline.length; i += 2) {
      pairs.push({
        moveNumber: timeline[i].moveNumber,
        white: timeline[i],
        black: timeline[i + 1],
        whiteIndex: i,
        blackIndex: i + 1,
      });
    }
    return pairs;
  }, [timeline]);

  const currentMove = currentMoveIndex >= 0 ? timeline[currentMoveIndex] : null;
  const currentEval = currentMove ? moveEvaluations[currentMove.ply] : null;

  const currentFen = currentMove?.fen ?? initialFen;
  const currentEvaluationState = currentMove
    ? moveEvaluations[currentMove.ply]
    : moveEvaluations[0];

  useEffect(() => {
    if (currentEval?.status === "success" && currentMove) {
      setLastEvaluationDisplay({
        evaluation: currentEval.evaluation,
        fen: currentMove.fen,
      });
    }
  }, [currentEval, currentMove]);

  const timelineStats = useMemo(() => {
    const stats = {
      evaluated: 0,
      loading: 0,
      pending: 0,
      errors: 0,
      total: timeline.length,
    };
    timeline.forEach((move) => {
      const status = moveEvaluations[move.ply]?.status ?? "idle";
      if (status === "success") {
        stats.evaluated += 1;
      } else if (status === "loading") {
        stats.loading += 1;
      } else if (status === "error") {
        stats.errors += 1;
      } else {
        stats.pending += 1;
      }
    });
    return {
      ...stats,
      progress: stats.total ? stats.evaluated / stats.total : 0,
    };
  }, [timeline, moveEvaluations]);

  const timelineEntries = useMemo(
    () =>
      timeline.map((move, index) => ({
        move,
        index,
        state: moveEvaluations[move.ply],
        phase: getMovePhase(move.moveNumber),
      })),
    [timeline, moveEvaluations]
  );

  const displayedEvaluation =
    currentEvaluationState?.status === "success"
      ? { evaluation: currentEvaluationState.evaluation, fen: currentFen }
      : currentEvaluationState?.status === "loading" && currentEvaluationState.previous
        ? { evaluation: currentEvaluationState.previous, fen: currentFen }
        : currentFen === lastEvaluationDisplay?.fen
          ? lastEvaluationDisplay
          : lastEvaluationDisplay;

  const stableEvaluation = displayedEvaluation || lastEvaluationDisplay || null;

  const bestMoveArrows = useMemo(() => {
    if (!showBestMoveArrow || !displayedEvaluation) return [] as Array<[Square, Square]>;
    const arrow = getArrowFromBestMove(displayedEvaluation.evaluation.bestMove);
    return arrow ? [arrow] : [];
  }, [showBestMoveArrow, displayedEvaluation]);
  const currentEvaluationScore = displayedEvaluation?.evaluation.score ?? null;
  const currentEvaluationMateWinner = displayedEvaluation
    ? getMateWinner(currentEvaluationScore, displayedEvaluation.fen)
    : undefined;
  const evaluationPercent = displayedEvaluation
    ? getEvalPercent(currentEvaluationScore, currentEvaluationMateWinner)
    : 0.5;
  const evaluationSummary = displayedEvaluation
    ? describeAdvantage(evaluationPercent, currentEvaluationScore, currentEvaluationMateWinner)
    : "No evaluation yet.";
  const engineStatus = currentEvaluationState?.status;
  const engineError = currentEvaluationState?.status === "error" ? currentEvaluationState.error : null;

  const handleLoadSample = () => {
    setPgnInput(SAMPLE_PGN.trim());
  };

  const requestEvaluation = useCallback(async (move: MoveSnapshot) => {
    setMoveEvaluations((prev) => {
      const prevState = prev[move.ply];
      const previousEvaluation =
        prevState?.status === "success"
          ? prevState.evaluation
          : prevState?.status === "loading"
            ? prevState.previous
            : undefined;
      return {
        ...prev,
        [move.ply]: { status: "loading", previous: previousEvaluation },
      };
    });
    try {
      const response = await fetch(`${API_BASE_URL}/api/review/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: move.fen, depth: 16 }),
      });
      const payload: EngineEvaluation | { error: string } = await response.json();
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to evaluate position");
      }
      setMoveEvaluations((prev) => ({
        ...prev,
        [move.ply]: { status: "success", evaluation: payload },
      }));
    } catch (err) {
      setMoveEvaluations((prev) => ({
        ...prev,
        [move.ply]: { status: "error", error: getErrorMessage(err, "Engine error") },
      }));
    }
  }, []);

  const resetReviewState = useCallback(() => {
    setAnalysisReady(false);
    setTimeline([]);
    setCurrentMoveIndex(-1);
    setMoveEvaluations({});
    setLastEvaluationDisplay(null);
    setIsAutoPlaying(false);
    setPgnInput("");
    setAnalysisError(null);
    setInputError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(REVIEW_STORAGE_KEY);
    }
  }, []);

  const handleStartNewReview = useCallback(() => {
    if (analysisReady) {
      setIsClearing(true);
      setTimeout(() => {
        resetReviewState();
        setIsClearing(false);
      }, 350);
    } else {
      resetReviewState();
    }
  }, [analysisReady, resetReviewState]);

  const bootstrapTimeline = (moves: MoveSnapshot[], autoEvaluateFirst = false) => {
    setTimeline(moves);
    setCurrentMoveIndex(moves.length ? 0 : -1);
    const map: Record<number, MoveEvalState> = {};
    moves.forEach((move) => {
      map[move.ply] = { status: "idle" };
    });
    setMoveEvaluations(map);
    setLastEvaluationDisplay(null);
    setIsAutoPlaying(false);
    if (autoEvaluateFirst && moves.length) {
      requestEvaluation(moves[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!pgnInput.trim()) return;
    setInputError(null);
    setAnalysisError(null);

    let parsedMoves: MoveSnapshot[] = [];
    try {
      parsedMoves = buildTimelineFromPgn(pgnInput);
    } catch (err) {
      setInputError(getErrorMessage(err, "Invalid PGN"));
      return;
    }

    if (!parsedMoves.length) {
      setInputError("Game must contain at least one move");
      return;
    }

    setAnalysisLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/review/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pgn: pgnInput,
          depth: 16,
          samples: Math.min(parsedMoves.length, 10),
        }),
      });
      const payload: GameAnalysisResponse | { error: string } = await response.json();
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to analyze game");
      }

      const timelineResult = payload.timeline ?? parsedMoves;
      bootstrapTimeline(timelineResult, true);
      setMoveEvaluations((prev) => mergeSampleEvaluations(prev, payload.samples));
      setAnalysisReady(true);
      setAnalysisKey((prev) => prev + 1);
    } catch (err) {
      setAnalysisError(getErrorMessage(err, "Failed to run analysis"));
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleSelectMove = useCallback(
    (index: number) => {
      if (index < -1 || index > timeline.length - 1) return;
      setCurrentMoveIndex(index);
      if (index >= 0) {
        const move = timeline[index];
        const state = moveEvaluations[move.ply];
        if (!state || state.status === "idle") {
          requestEvaluation(move);
        }
      }
    },
    [moveEvaluations, requestEvaluation, timeline]
  );

  useEffect(() => {
    if (!isAutoPlaying) return;
    if (!timeline.length) {
      setIsAutoPlaying(false);
      return;
    }
    const nextIndex =
      currentMoveIndex < timeline.length - 1 ? currentMoveIndex + 1 : currentMoveIndex === -1 ? 0 : null;
    if (nextIndex == null) {
      setIsAutoPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      handleSelectMove(nextIndex);
    }, 1500);
    return () => clearTimeout(timer);
  }, [handleSelectMove, isAutoPlaying, currentMoveIndex, timeline]);

  useEffect(() => {
    if (currentMoveIndex < 0) return;
    const listContainer = document.querySelector<HTMLElement>("[data-move-list]");
    const activeButton = document.querySelector<HTMLElement>(`[data-move-index="${currentMoveIndex}"]`);
    if (!listContainer || !activeButton) return;
    const containerRect = listContainer.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const offset = buttonRect.top - containerRect.top - containerRect.height / 2 + buttonRect.height / 2;
    listContainer.scrollBy({ top: offset, behavior: "smooth" });
  }, [currentMoveIndex]);

  useEffect(() => {
    if (!analysisReady || !timeline.length) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleSelectMove(Math.max(currentMoveIndex - 1, -1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleSelectMove(Math.min(currentMoveIndex + 1, timeline.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        handleSelectMove(timeline.length - 1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        handleSelectMove(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [analysisReady, timeline.length, currentMoveIndex, handleSelectMove]);

  const handleToggleAutoPlay = () => {
    if (!timeline.length) return;
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      return;
    }
    const nextIndex =
      currentMoveIndex < timeline.length - 1 ? currentMoveIndex + 1 : currentMoveIndex === -1 ? 0 : currentMoveIndex;
    if (nextIndex !== null && nextIndex !== currentMoveIndex) {
      handleSelectMove(nextIndex);
    }
    setIsAutoPlaying(true);
  };

  useEffect(() => {
    if (!analysisReady || isClearing) return;
    const hasLoading = Object.values(moveEvaluations).some((state) => state?.status === "loading");
    if (hasLoading) return;
    if (!moveEvaluations[0] || moveEvaluations[0]?.status === "idle") {
      requestEvaluation(startingSnapshot);
      return;
    }
    const pendingMove = timeline.find((move) => {
      const state = moveEvaluations[move.ply];
      return !state || state.status === "idle";
    });
    if (pendingMove) {
      requestEvaluation(pendingMove);
    }
  }, [analysisReady, isClearing, moveEvaluations, requestEvaluation, startingSnapshot, timeline]);

  const handleInspectFromTimeline = (index: number) => {
    handleSelectMove(index);
    setSelectedView("analysis");
  };

  const handleEvaluateFromTimeline = (move: MoveSnapshot) => {
    const state = moveEvaluations[move.ply];
    if (state?.status === "loading" || state?.status === "success") return;
    requestEvaluation(move);
  };

  // const evaluatedMoves = useMemo(() => {
  //   return timeline.filter(
  //     (move) => reviewedPlies.has(move.ply) && moveEvaluations[move.ply]?.status === "success"
  //   );
  // }, [timeline, moveEvaluations, reviewedPlies]);

  const atEnd = currentMoveIndex >= timeline.length - 1;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 text-gray-800 px-6 py-24">
        <div className="max-w-6xl mx-auto space-y-10">
          <GameReviewHeader analysisReady={analysisReady} onLoadNewPGN={handleStartNewReview} />

          {!analysisReady && (
            <div className="w-full max-w-3xl mx-auto">
              <GameInputCard
                pgnInput={pgnInput}
                onChange={setPgnInput}
                onLoadSample={handleLoadSample}
                onAnalyze={handleAnalyze}
                canAnalyze={Boolean(pgnInput.trim())}
                loading={analysisLoading}
                inputError={inputError}
                analysisError={analysisError}
              />
            </div>
          )}

          {analysisReady && selectedView === "analysis" && (
            <section
              key={analysisKey}
              className={`grid grid-cols-1 xl:grid-cols-[2fr_1fr] items-start gap-8 ${isClearing ? "fade-out" : "fade-in"}`}
            >
              <BoardAnalysisCard
                boardPosition={boardPosition}
                boardWidth={boardSize}
                boardOrientation={boardOrientation}
                boardColors={BOARD_THEMES[boardTheme]}
                evaluationPercent={evaluationPercent}
                evaluationSummary={evaluationSummary}
                currentEvaluationScore={currentEvaluationScore}
                bestMoveArrows={bestMoveArrows}
                timelineLength={timeline.length}
                currentMoveIndex={currentMoveIndex}
                atEnd={atEnd}
                isAutoPlaying={isAutoPlaying}
                showBestMoveArrow={showBestMoveArrow}
                onSelectMove={handleSelectMove}
                onToggleAutoPlay={handleToggleAutoPlay}
                onFlipBoard={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                onToggleBestMoveArrow={() => setShowBestMoveArrow((prev) => !prev)}
                onOpenThemeModal={() => setIsThemeModalOpen(true)}
              />

              <div className="flex flex-col gap-6 self-start">
                <MoveListCard movePairs={movePairs} currentMoveIndex={currentMoveIndex} onSelectMove={handleSelectMove} />

                <EngineAnalysisCard
                  engineStatus={engineStatus}
                  engineError={engineError}
                  stableEvaluation={stableEvaluation}
                  currentMoveNumber={currentMove?.moveNumber}
                />
              </div>
            </section>
          )}

          {/* Timeline view temporarily hidden
          {analysisReady && selectedView === "timeline" && (
            <section className="fade-in">
              ...
            </section>
          )}
          */}

          {/* Insights view temporarily hidden
          {analysisReady && selectedView === "insights" && (
            <section className="fade-in">
              ...
            </section>
          )}
          */}

          {/* Engine findings intentionally hidden for demo */}
        </div>
      </div>

      <ThemeSelectorModal
        open={isThemeModalOpen}
        themes={BOARD_THEMES}
        selectedKey={boardTheme}
        onSelect={(key) => {
          setBoardTheme(key as BoardThemeKey);
          setIsThemeModalOpen(false);
        }}
        onClose={() => setIsThemeModalOpen(false)}
      />
    </>
  );
}

function getArrowFromBestMove(bestMove?: string | null): [Square, Square] | null {
  if (!bestMove || !UCI_MOVE_REGEX.test(bestMove)) return null;
  const from = bestMove.slice(0, 2);
  const to = bestMove.slice(2, 4);
  const squareRegex = /^[a-h][1-8]$/;
  if (!squareRegex.test(from) || !squareRegex.test(to)) return null;
  return [from as Square, to as Square];
}
function getMovePhase(moveNumber: number): "Opening" | "Middlegame" | "Endgame" {
  if (moveNumber <= 10) return "Opening";
  if (moveNumber <= 30) return "Middlegame";
  return "Endgame";
}

const BOARD_THEMES: Record<
  BoardThemeKey,
  {
    light: string;
    dark: string;
    label: string;
  }
> = {
  modern: { light: "#f5f7fa", dark: "#aeb8c2", label: "Modern" },
  wood: { light: "#f6e8d0", dark: "#c49c6b", label: "Wood" },
  aero: { light: "#e3f2fd", dark: "#90a4ae", label: "Aero" },
  dusk: { light: "#ede9fe", dark: "#a78bfa", label: "Dusk" },
  forest: { light: "#e9f5ec", dark: "#8bc9a3", label: "Forest" },
  ocean: { light: "#e6f7ff", dark: "#7cc0d8", label: "Ocean" },
};
