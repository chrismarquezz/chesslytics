import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Palette,
  Play,
  Pause,
  Swords,
} from "lucide-react";
import BoardControlButton from "../components/review/BoardControlButton";
import Navbar from "../components/Navbar";
import GameInputCard from "../components/review/GameInputCard";
// import EngineFindingsCard, {
//   type FindingRow as EngineFindingRow,
//   type QualityCard as EngineQualityCard,
// } from "../components/review/EngineFindingsCard";
import ThemeSelectorModal from "../components/review/ThemeSelectorModal";

type View = "analysis" | "timeline" | "insights";
type BoardThemeKey = "modern" | "wood" | "aero";

type MoveSnapshot = {
  ply: number;
  moveNumber: number;
  san: string;
  color: "white" | "black";
  fen: string;
};

type EngineScore = { type: "cp" | "mate"; value: number };
type EngineEvaluation = {
  bestMove: string;
  score: EngineScore | null;
  depth: number;
  pv: string[];
};

type MoveEvalState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; evaluation: EngineEvaluation }
  | { status: "error"; error: string };

interface GameSummary {
  totalMoves: number;
  sampled: number;
  depth: number;
}

interface EngineSample extends MoveSnapshot {
  evaluation: EngineEvaluation | null;
  error?: string;
}

interface GameAnalysisResponse {
  summary: GameSummary;
  timeline: MoveSnapshot[];
  samples: EngineSample[];
}

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
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O
9. h3 Nb8 10. d4 Nbd7 11. c4 c6 12. Nc3 Bb7 13. cxb5 axb5 14. Bg5 b4 15. Na4 c5
16. dxe5 Nxe4 17. Bxe7 Qxe7 18. exd6 Qf6 19. Bd5 Bxd5 20. Qxd5 Nxd6 21. Nxc5 Nb6
22. Qc6 Nbc4 23. Nd7 Qxb2 24. Nxf8 Rxf8 25. Reb1 Qf6 26. Rd1 Rc8 27. Qa6 Qe7
28. Rac1 h6 29. Nd4 Qg5 30. Nc6 Re8 31. Rxc4 Nxc4 32. Qxc4 Qh5 33. Rd5 Re1+ 34. Kh2 Qd1
35. Rxd1 Rxd1 36. Ne7+ Kh7 37. Qxf7 1-0`;

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

  const movePairs = useMemo(() => {
    const pairs: Array<{
      moveNumber: number;
      white?: MoveSnapshot;
      black?: MoveSnapshot;
      whiteIndex: number;
      blackIndex: number;
    }> = [];
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

  const bestMoveArrows = useMemo(() => {
    if (!showBestMoveArrow) return [] as Array<[Square, Square]>;
    if (currentEval?.status !== "success") return [];
    const arrow = getArrowFromBestMove(currentEval.evaluation.bestMove);
    return arrow ? [arrow] : [];
  }, [showBestMoveArrow, currentEval]);

  const displayedEvaluation =
    currentEval?.status === "success" && currentMove
      ? { evaluation: currentEval.evaluation, fen: currentMove.fen }
      : currentMove && lastEvaluationDisplay?.fen === currentMove.fen
        ? lastEvaluationDisplay
        : null;
  const currentEvaluationScore = displayedEvaluation?.evaluation.score ?? null;
  const currentEvaluationMateWinner = displayedEvaluation
    ? getMateWinner(currentEvaluationScore, displayedEvaluation.fen)
    : undefined;
  const evaluationPercent = getEvalPercent(currentEvaluationScore, currentEvaluationMateWinner);
  const evaluationSummary = displayedEvaluation
    ? describeAdvantage(evaluationPercent, currentEvaluationScore, currentEvaluationMateWinner)
    : "No evaluation yet.";

  const handleLoadSample = () => {
    setPgnInput(SAMPLE_PGN.trim());
  };

  const requestEvaluation = useCallback(async (move: MoveSnapshot) => {
    setMoveEvaluations((prev) => ({
      ...prev,
      [move.ply]: { status: "loading" },
    }));
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
    setIsAutoPlaying((prev) => !prev);
  };

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
          <header>
            <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-2">Review</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Game Review</h1>
                <p className="text-gray-600 mt-1">
                  Paste your PGN, replay moves on the board, and let Stockfish surface insights as you go.
                </p>
              </div>
              {analysisReady && (
                <button
                  onClick={handleStartNewReview}
                  className="self-start sm:self-auto px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition"
                >
                  Load New PGN
                </button>
              )}
              {/* Timeline/Insights tabs hidden for now */}
            </div>
          </header>

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
              className={`grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8 ${isClearing ? "fade-out" : "fade-in"}`}
            >
              <div className="bg-white shadow-lg rounded-2xl border border-gray-200 p-6 flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-gray-600">
                    <span>White</span>
                    <span>Black</span>
                  </div>
                  <div className="relative h-6 border border-gray-300 rounded overflow-hidden bg-white">
                    <div className="absolute inset-0 bg-gray-900" />
                    <div
                      className="absolute inset-y-0 left-0 bg-white transition-all duration-300"
                      style={{ width: `${evaluationPercent * 100}%` }}
                    />
                    <div className="relative z-10 flex h-full text-xs font-semibold">
                      <div className="w-1/2 flex items-center pl-2 text-gray-800">
                        {evaluationPercent >= 0.5 && currentEvaluationScore ? formatScore(currentEvaluationScore) : ""}
                      </div>
                      <div className="w-1/2 flex items-center justify-end pr-2 text-white">
                        {evaluationPercent < 0.5 && currentEvaluationScore ? formatScore(currentEvaluationScore) : ""}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-center text-gray-600">{evaluationSummary}</p>
                </div>
                <div className="flex justify-center">
                  <Chessboard
                    position={boardPosition}
                    boardWidth={boardSize}
                  boardOrientation={boardOrientation}
                  arePiecesDraggable={false}
                  customDarkSquareStyle={{ backgroundColor: BOARD_THEMES[boardTheme].dark }}
                  customLightSquareStyle={{ backgroundColor: BOARD_THEMES[boardTheme].light }}
                  customBoardStyle={{ borderRadius: 0 }}
                  customArrows={bestMoveArrows}
                />
              </div>
              <div className="flex flex-wrap gap-4 items-center border-t border-gray-100 pt-4">
                <div className="flex gap-2 justify-start flex-shrink-0">
                  <BoardControlButton
                    onClick={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                    disabled={!timeline.length}
                    label="Flip Board"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </BoardControlButton>
                </div>
                <div className="flex flex-1 flex-wrap md:flex-nowrap gap-2 justify-center">
                  <BoardControlButton
                    onClick={() => handleSelectMove(0)}
                    disabled={!timeline.length}
                    label="First move"
                  >
                    <ChevronFirst className="h-4 w-4" />
                  </BoardControlButton>
                  <BoardControlButton
                    onClick={() => handleSelectMove(Math.max(currentMoveIndex - 1, -1))}
                    disabled={timeline.length === 0 || currentMoveIndex <= 0}
                    label="Previous move"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </BoardControlButton>
                  <BoardControlButton
                    onClick={handleToggleAutoPlay}
                    active={isAutoPlaying}
                    disabled={!timeline.length}
                    label={isAutoPlaying ? "Pause" : "Play"}
                  >
                    {isAutoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </BoardControlButton>
                  <BoardControlButton
                    onClick={() => handleSelectMove(Math.min(currentMoveIndex + 1, timeline.length - 1))}
                    disabled={timeline.length === 0 || atEnd}
                    label="Next move"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </BoardControlButton>
                  <BoardControlButton
                    onClick={() => handleSelectMove(timeline.length - 1)}
                    disabled={!timeline.length}
                    label="Last move"
                  >
                    <ChevronLast className="h-4 w-4" />
                  </BoardControlButton>
                </div>
                <div className="flex gap-2 justify-end flex-shrink-0">
                  <BoardControlButton
                    onClick={() => setShowBestMoveArrow((prev) => !prev)}
                    active={showBestMoveArrow}
                    label={showBestMoveArrow ? "Hide Hint" : "Show Hint"}
                  >
                    <Swords className="h-4 w-4" />
                  </BoardControlButton>
                  <BoardControlButton
                    onClick={() => setIsThemeModalOpen(true)}
                    label="Change Theme"
                  >
                    <Palette className="h-4 w-4" />
                  </BoardControlButton>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 rounded-2xl border border-gray-200 overflow-hidden">
                <div className="max-h-96 overflow-y-auto bg-gray-50" data-move-list>
                  {timeline.length ? (
                    <table className="w-full text-sm text-gray-700">
                      <thead className="text-xs uppercase tracking-wide text-gray-100 bg-gray-800 sticky top-0 z-10">
                        <tr>
                          <th className="py-3 pr-4 text-center font-semibold">#</th>
                          <th className="py-3 px-4 text-center font-semibold">White</th>
                          <th className="py-3 px-4 text-center font-semibold">Black</th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-50">
                        {movePairs.map((pair) => (
                          <tr key={pair.moveNumber} className="border-b border-gray-200 last:border-none">
                            <td className="py-2 pr-4 text-xs font-mono text-gray-500 text-center">{pair.moveNumber}</td>
                            <td className="py-1 px-4">
                              {pair.white ? (
                                <button
                                  data-move-index={pair.whiteIndex}
                                  className={`w-full text-center px-2 py-1 rounded-lg transition ${
                                    currentMoveIndex === pair.whiteIndex
                                      ? "bg-[#00bfa6]/10 text-[#00bfa6]"
                                      : "hover:bg-white"
                                  }`}
                                  onClick={() => handleSelectMove(pair.whiteIndex)}
                                >
                                  {pair.white.san}
                                </button>
                              ) : (
                                <span className="block text-center text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-1 px-4">
                              {pair.black ? (
                                <button
                                  data-move-index={pair.blackIndex}
                                  className={`w-full text-center px-2 py-1 rounded-lg transition ${
                                    currentMoveIndex === pair.blackIndex
                                      ? "bg-[#00bfa6]/10 text-[#00bfa6]"
                                      : "hover:bg-white"
                                  }`}
                                  onClick={() => handleSelectMove(pair.blackIndex)}
                                >
                                  {pair.black.san}
                                </button>
                              ) : (
                                <span className="block text-center text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center text-gray-500">Load a PGN to populate moves.</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow hover:shadow-2xl transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold text-gray-800">Evaluation</h2>
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    {currentMove ? `Move ${currentMove.moveNumber}` : "No move selected"}
                  </span>
                </div>
                {!currentMove ? (
                  <p className="text-gray-500 text-sm">
                    Select a move to fetch Stockfish feedback for that position.
                  </p>
                ) : currentEval?.status === "error" ? (
                  <p className="text-sm text-red-500">Engine error: {currentEval.error}</p>
                ) : displayedEvaluation ? (
                  <EvaluationDetails
                    evaluation={displayedEvaluation.evaluation}
                    fen={displayedEvaluation.fen}
                  />
                ) : (
                  <p className="text-sm text-gray-500">
                    No evaluation yet. Step through the move or rerun analysis to prefetch Stockfish output.
                  </p>
                )}
              </div>
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

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (typeof err === "string" && err.trim()) {
    return err;
  }
  return fallback;
}

function mergeSampleEvaluations(
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

function buildTimelineFromPgn(pgn: string): MoveSnapshot[] {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    throw new Error("Invalid PGN format");
  }
  const verboseMoves = chess.history({ verbose: true });
  chess.reset();

  const snapshots: MoveSnapshot[] = [];
  verboseMoves.forEach((move, index) => {
    chess.move(move);
    snapshots.push({
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      san: move.san,
      color: move.color === "w" ? "white" : "black",
      fen: chess.fen(),
    });
  });
  return snapshots;
}

function formatScore(score: EngineScore | null) {
  if (!score) return "—";
  if (score.type === "mate") {
    return `M${score.value}`;
  }
  const value = (score.value / 100).toFixed(2);
  return value.startsWith("-") ? value : `+${value}`;
}

function getArrowFromBestMove(bestMove?: string | null): [Square, Square] | null {
  if (!bestMove || bestMove.length < 4) return null;
  const from = bestMove.slice(0, 2);
  const to = bestMove.slice(2, 4);
  const squareRegex = /^[a-h][1-8]$/;
  if (!squareRegex.test(from) || !squareRegex.test(to)) return null;
  return [from as Square, to as Square];
}

function formatBestMoveSan(bestMove?: string | null, fen?: string) {
  if (!bestMove) return "—";
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

function formatPvLines(pv: string[], fen?: string): string[] {
  if (!pv.length) return [];
  const engine = fen ? new Chess(fen) : new Chess();
  const fenParts = fen?.split(" ");
  let turn: "w" | "b" = fenParts && fenParts[1] === "b" ? "b" : "w";
  let moveNumber = fenParts && fenParts[5] ? Number(fenParts[5]) || 1 : 1;
  const moves: string[] = [];

  for (const move of pv) {
    const parsed = engine.move({
      from: move.slice(0, 2) as Square,
      to: move.slice(2, 4) as Square,
      promotion: move[4],
    });
    if (!parsed) break;

    const isWhiteMove = turn === "w";
    const prefix = isWhiteMove ? `${moveNumber}.` : `${moveNumber}...`;
    moves.push(`${prefix} ${parsed.san}`);
    if (!isWhiteMove) moveNumber += 1;
    turn = isWhiteMove ? "b" : "w";
  }

  return moves.length ? [moves.join(" ")] : [];
}

function getMateWinner(score: EngineScore | null, fen?: string): "White" | "Black" | undefined {
  if (!score || score.type !== "mate") return undefined;
  if (score.value > 0) return "White";
  if (score.value < 0) return "Black";
  const turn = fen?.split(" ")[1];
  if (turn === "w") return "Black";
  if (turn === "b") return "White";
  return undefined;
}

function EvaluationDetails({ evaluation, fen }: { evaluation: EngineEvaluation; fen?: string }) {
  const mateWinner = getMateWinner(evaluation.score, fen);
  const percent = getEvalPercent(evaluation.score, mateWinner);
  const advantageText = describeAdvantage(percent, evaluation.score, mateWinner);
  const bestMoveSan = formatBestMoveSan(evaluation.bestMove, fen);
  const pvLines = formatPvLines(evaluation.pv, fen);

  return (
    <div className="text-sm text-gray-700 space-y-1">
      <p>
        Best Move: <span className="font-semibold">{bestMoveSan}</span>
      </p>
      <p>Depth: {evaluation.depth}</p>
      {/* PV rendering temporarily disabled */}
      <p className="text-xs text-gray-500 pt-2">{advantageText}</p>
    </div>
  );
}

function getEvalPercent(score: EngineScore | null, mateWinner?: "White" | "Black"): number {
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

function describeAdvantage(
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

function getMovePhase(moveNumber: number): "Opening" | "Middlegame" | "Endgame" {
  if (moveNumber <= 10) return "Opening";
  if (moveNumber <= 30) return "Middlegame";
  return "Endgame";
}

function getEvaluationDisplay(state?: MoveEvalState, fen?: string) {
  if (!state || state.status === "idle") {
    return {
      label: "Not evaluated",
      tone: "text-gray-500",
      dotClass: "bg-gray-300",
      sublabel: "",
    };
  }
  if (state.status === "loading") {
    return {
      label: "Analyzing…",
      tone: "text-blue-600",
      dotClass: "bg-blue-400 animate-pulse",
      sublabel: "",
    };
  }
  if (state.status === "error") {
    return {
      label: state.error || "Engine error",
      tone: "text-red-500",
      dotClass: "bg-red-500",
      sublabel: "",
    };
  }
  const scoreLabel = formatScore(state.evaluation.score);
  const mateWinner = getMateWinner(state.evaluation.score, fen);
  const percent = getEvalPercent(state.evaluation.score, mateWinner);
  return {
    label: `Score ${scoreLabel}`,
    tone: "text-[#00bfa6]",
    dotClass: "bg-[#00bfa6]",
    sublabel: describeAdvantage(percent, state.evaluation.score, mateWinner),
  };
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
