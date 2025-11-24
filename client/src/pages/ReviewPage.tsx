import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Chess, type Square } from "chess.js";
import Navbar from "../components/Navbar";
import GameInputCard from "../components/review/GameInputCard";
import ThemeSelectorModal from "../components/review/ThemeSelectorModal";
import BoardAnalysisCard from "../components/review/BoardAnalysisCard";
import MoveQualityCard from "../components/review/MoveQualityCard";
import MoveListCard, { type MovePair } from "../components/review/MoveListCard";
import EngineAnalysisCard from "../components/review/EngineAnalysisCard";
import type {
  BoardThemeKey,
  BookMoveStatus,
  BookPositionInfo,
  EngineEvaluation,
  GameAnalysisResponse,
  MoveEvalState,
  MoveQuality,
  MoveSnapshot,
} from "../types/review";
import {
  UCI_MOVE_REGEX,
  buildTimelineFromPgn,
  getErrorMessage,
  getEvalPercent,
  getMateWinner,
  mergeSampleEvaluations,
  classifyMoveQuality,
} from "../utils/reviewEngine";

type View = "analysis" | "timeline" | "insights";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:5100";
const REVIEW_STORAGE_KEY = "chesslab-review-state";
const PLAYER_NAMES_STORAGE_KEY = "chesslab-player-names";
const PLAYER_CLOCK_STORAGE_KEY = "chesslab-player-clock";

interface GameResultInfo {
  result: string;
  termination?: string;
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

function parseStartingClock(pgn: string): string | null {
  const timeControlMatch = /\[TimeControl\s+"([^"]+)"\]/i.exec(pgn);
  if (!timeControlMatch) return null;
  const raw = timeControlMatch[1];
  const basePart = raw.split(/[\+:]/)[0];

  const parseSeconds = (value: string): number | null => {
    if (value.includes(":")) {
      const segments = value.split(":").map((v) => Number(v));
      if (segments.some((n) => !Number.isFinite(n) || n < 0)) return null;
      while (segments.length < 3) segments.unshift(0);
      const [hours, minutes, seconds] = segments;
      return hours * 3600 + minutes * 60 + seconds;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    // If the base is very small (e.g. "1" for 1-minute bullet), treat it as minutes.
    return numeric <= 30 ? numeric * 60 : numeric;
  };

  const baseSeconds = parseSeconds(basePart);
  if (!baseSeconds) return null;
  const hours = Math.floor(baseSeconds / 3600);
  const minutes = Math.floor((baseSeconds % 3600) / 60);
  const seconds = baseSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

export default function ReviewPage() {
  const [pgnInput, setPgnInput] = useState("");
  const [selectedView] = useState<View>("analysis");
  const [timeline, setTimeline] = useState<MoveSnapshot[]>([]);
  const [fallbackOpening, setFallbackOpening] = useState<string | null>(null);
  const [headerEndTime, setHeaderEndTime] = useState<number | null>(null);
  const [fullReviewDone, setFullReviewDone] = useState(false);
  const [playerNames, setPlayerNames] = useState(() => {
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem(PLAYER_NAMES_STORAGE_KEY);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return { white: "White", black: "Black" };
        }
      }
    }
    return { white: "White", black: "Black" };
  });
  const [playerClock, setPlayerClock] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(PLAYER_CLOCK_STORAGE_KEY);
    }
    return null;
  });
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [moveEvaluations, setMoveEvaluations] = useState<Record<number, MoveEvalState>>({});
  const [bookStatusByPly, setBookStatusByPly] = useState<Record<number, BookMoveStatus | undefined>>({});
  const [lastEvaluationDisplay, setLastEvaluationDisplay] = useState<{
    evaluation: EngineEvaluation;
    fen?: string;
  } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analysisKey, setAnalysisKey] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [boardSize, setBoardSize] = useState(640);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("chesslab-theme") as BoardThemeKey | null;
      if (stored && stored in BOARD_THEMES) {
        return stored;
      }
    }
    return "modern";
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [gameResult, setGameResult] = useState<GameResultInfo | null>(null);
  const bookCacheRef = useRef<Record<string, BookPositionInfo | null>>({});
  const moveEvalSourcesRef = useRef<Record<number, EventSource | null>>({});
  const location = useLocation();
  const navigate = useNavigate();

  const initialFen = useMemo(() => new Chess().fen(), []);
  const startingSnapshot = useMemo<MoveSnapshot>(
    () => ({
      ply: 0,
      moveNumber: 0,
      san: "start",
      color: "white",
      fen: initialFen,
      uci: "",
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
    window.localStorage.setItem("chesslab-theme", boardTheme);
  }, [boardTheme]);

  useEffect(() => {
    if (!timeline.length) {
      setIsAutoPlaying(false);
    }
  }, [timeline.length]);

  useEffect(() => {
    if (analysisLoading) {
      setShowAnalysisModal(true);
      setLoadingProgress(5);
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) return prev;
          const next = prev + Math.random() * 5;
          return Math.min(next, 85);
        });
      }, 400);
      return () => clearInterval(interval);
    }
    setLoadingProgress(100);
    const timeout = setTimeout(() => {
      setShowAnalysisModal(false);
      setLoadingProgress(0);
    }, 350);
    return () => clearTimeout(timeout);
  }, [analysisLoading]);


  const boardPosition =
    currentMoveIndex >= 0 && timeline[currentMoveIndex] ? timeline[currentMoveIndex].fen : initialFen;
  const boardCardWidth = Math.max(boardSize + 48, 360);

  const whiteDisplayName = playerNames.white && playerNames.white !== "?" ? playerNames.white : "White";
  const blackDisplayName = playerNames.black && playerNames.black !== "?" ? playerNames.black : "Black";
  const whiteHeaderLabel = whiteDisplayName;
  const blackHeaderLabel = blackDisplayName;

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
  const lastMoveSquares = useMemo(() => {
    if (!currentMove?.uci || currentMove.uci.length < 4) return null;
    return { from: currentMove.uci.slice(0, 2), to: currentMove.uci.slice(2, 4) };
  }, [currentMove]);

  const currentFen = currentMove?.fen ?? initialFen;
  const currentEvaluationState = currentMove
    ? moveEvaluations[currentMove.ply]
    : moveEvaluations[0];

  const clockTimeline = useMemo(() => {
    const baseClock = playerClock ?? null;
    const map: Record<number, { white: string | null; black: string | null }> = {
      0: { white: baseClock, black: baseClock },
    };
    let whiteClock: string | null = baseClock;
    let blackClock: string | null = baseClock;
    timeline.forEach((move) => {
      if (move.clock) {
        if (move.color === "white") {
          whiteClock = move.clock;
        } else {
          blackClock = move.clock;
        }
      }
      map[move.ply] = { white: whiteClock, black: blackClock };
    });
    return map;
  }, [playerClock, timeline]);

  const earliestClockByColor = useMemo(() => {
    let firstWhite: string | null = null;
    let firstBlack: string | null = null;
    for (const move of timeline) {
      if (move.clock) {
        if (move.color === "white" && !firstWhite) firstWhite = move.clock;
        if (move.color === "black" && !firstBlack) firstBlack = move.clock;
      }
      if (firstWhite && firstBlack) break;
    }
    return { white: firstWhite, black: firstBlack };
  }, [timeline]);

  const currentClockSnapshot = useMemo(() => {
    const baseClock = playerClock ?? null;
    if (currentMove && clockTimeline[currentMove.ply]) {
      return clockTimeline[currentMove.ply];
    }
    if (currentMoveIndex < 0 && clockTimeline[0]) {
      return clockTimeline[0];
    }
    if (timeline.length && clockTimeline[timeline[0].ply]) {
      return clockTimeline[timeline[0].ply];
    }
    return { white: baseClock, black: baseClock };
  }, [clockTimeline, currentMove, currentMoveIndex, playerClock, timeline]);

  // Prefer the current ply clock, then the starting time control, then the earliest clock seen for that color.
  const whiteClockDisplay =
    currentClockSnapshot.white ?? playerClock ?? earliestClockByColor.white ?? earliestClockByColor.black ?? null;
  const blackClockDisplay =
    currentClockSnapshot.black ?? playerClock ?? earliestClockByColor.black ?? earliestClockByColor.white ?? null;

  const moveClassifications = useMemo<Record<number, MoveQuality | undefined>>(() => {
    if (!fullReviewDone) return {};
    const map: Record<number, MoveQuality | undefined> = {};
    timeline.forEach((move, index) => {
      const prevSnapshot = index === 0 ? startingSnapshot : timeline[index - 1];
      const prevEval = getEvaluationSnapshot(moveEvaluations[prevSnapshot.ply]);
      const currEval = getEvaluationSnapshot(moveEvaluations[move.ply]);
      if (!currEval) return;
      const previousFen = index === 0 ? initialFen : prevSnapshot.fen;
      const forcedMove = isForcedMove(previousFen);
      const quality = classifyMoveQuality({
        previousScore: prevEval?.score ?? null,
        currentScore: currEval.score,
        mover: move.color,
        previousFen,
        currentFen: move.fen,
        forcedMove,
      });
      if (quality) {
        map[move.ply] = quality;
      }
    });
    return map;
  }, [fullReviewDone, timeline, moveEvaluations, startingSnapshot, initialFen]);

  const lastMoveColor = useMemo(() => {
    if (!currentMove || !fullReviewDone) return null;
    const bookStatus = bookStatusByPly[currentMove.ply];
    if (bookStatus?.inBook) {
      return "#7b4a24"; // brown aligned with book badge
    }
    const quality = moveClassifications[currentMove.ply]?.label;
    switch (quality) {
      case "Best":
        return "#34d399"; // emerald from card
      case "Good":
        return "#38bdf8"; // sky from card
      case "Inaccuracy":
        return "#fbbf24"; // amber from card
      case "Mistake":
        return "#fb923c"; // orange from card
      case "Blunder":
        return "#fca5a5"; // red from card
      case "Forced":
        return "#e5e7eb"; // gray from card badge
      case "Miss":
        return "#fb7185"; // rose from card
      default:
        return "#fcd34d"; // default yellow
    }
  }, [bookStatusByPly, currentMove, moveClassifications]);

  const gameHeaderCard = useMemo(() => {
    const tags = extractTagsFromPgn(pgnInput);
    const resultLabel = formatResultLabel(gameResult?.result);
    const openingLabel = tags.opening ?? tags.variation ?? fallbackOpening ?? "Opening unavailable";
    const whiteRating = tags.whiteElo;
    const blackRating = tags.blackElo;
    const timeControlLabel = formatTimeControlLabel(tags.timeControl) ?? "—";
    const dateLabel = formatUtcDateLabel({
      utcDate: tags.utcDate,
      utcTime: tags.utcTime,
      fallbackEpochSeconds: headerEndTime,
    });

    const whiteLabel = `${whiteDisplayName}${whiteRating ? ` (${whiteRating})` : ""}`;
    const blackLabel = `${blackDisplayName}${blackRating ? ` (${blackRating})` : ""}`;

    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">{resultLabel}</p>
          <p className="text-xs text-gray-500">{openingLabel}</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border border-gray-300 bg-white" />
            <span className="text-sm font-semibold text-gray-900">{whiteLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-900" />
            <span className="text-sm font-semibold text-gray-900">{blackLabel}</span>
          </div>
        </div>
        <div className="text-xs text-gray-600">
          <span>{timeControlLabel}</span>
          {dateLabel ? <span className="ml-2 text-gray-500">· {dateLabel}</span> : null}
        </div>
      </div>
    );
  }, [blackDisplayName, fallbackOpening, gameResult?.result, headerEndTime, pgnInput, whiteDisplayName]);

  const currentMoveClassification = currentMove ? moveClassifications[currentMove.ply] : undefined;

  useEffect(() => {
    if (currentEval?.status === "success" && currentMove) {
      setLastEvaluationDisplay({
        evaluation: currentEval.evaluation,
        fen: currentMove.fen,
      });
    }
  }, [currentEval, currentMove]);

  const displayedEvaluation =
    currentEvaluationState?.status === "success"
      ? { evaluation: currentEvaluationState.evaluation, fen: currentFen }
      : currentEvaluationState?.status === "loading" && currentEvaluationState.previous
        ? { evaluation: currentEvaluationState.previous, fen: currentFen }
        : currentFen === lastEvaluationDisplay?.fen
          ? lastEvaluationDisplay
          : lastEvaluationDisplay;

  const stableEvaluation = displayedEvaluation || lastEvaluationDisplay || null;

  const drawInfo =
    gameResult?.result === "1/2-1/2" && timeline.length > 0 && currentMoveIndex === timeline.length - 1
      ? { result: gameResult.result, reason: gameResult.termination }
      : undefined;

  const isDrawnPosition = Boolean(drawInfo);

  const bestMoveArrows = useMemo(() => {
    if (!showBestMoveArrow || !displayedEvaluation || isDrawnPosition) return [] as Array<[Square, Square]>;
    const arrow = getArrowFromBestMove(displayedEvaluation.evaluation.bestMove);
    return arrow ? [arrow] : [];
  }, [showBestMoveArrow, displayedEvaluation, isDrawnPosition]);
  const currentEvaluationScore = displayedEvaluation?.evaluation.score ?? null;
  const currentEvaluationMateWinner = displayedEvaluation
    ? getMateWinner(currentEvaluationScore, displayedEvaluation.fen)
    : undefined;
  const evaluationPercent = displayedEvaluation
    ? getEvalPercent(currentEvaluationScore, currentEvaluationMateWinner)
    : 0.5;
  const engineStatus = currentEvaluationState?.status;
  const engineError = currentEvaluationState?.status === "error" ? currentEvaluationState.error : null;

  const handleLoadSample = () => {
    setPgnInput(SAMPLE_PGN.trim());
  };

  const requestEvaluation = useCallback(
    (move: MoveSnapshot) => {
      if (typeof window === "undefined") return;
      const url = `${API_BASE_URL}/api/review/evaluate/stream?fen=${encodeURIComponent(move.fen)}&depth=22`;
      moveEvalSourcesRef.current[move.ply]?.close();
      const source = new EventSource(url);
      moveEvalSourcesRef.current[move.ply] = source;
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
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { evaluation?: EngineEvaluation; done?: boolean; error?: string };
          if (payload.error) {
            setMoveEvaluations((prev) => ({
              ...prev,
              [move.ply]: { status: "error", error: payload.error || "Engine stream error" },
            }));
            source.close();
            moveEvalSourcesRef.current[move.ply] = null;
            return;
          }
          if (!payload.evaluation) {
            if (payload.done) {
              source.close();
              moveEvalSourcesRef.current[move.ply] = null;
            }
            return;
          }
          const evaluation: EngineEvaluation = payload.evaluation;
          setMoveEvaluations(
            (prev): Record<number, MoveEvalState> => ({
              ...prev,
              [move.ply]: { status: "success", evaluation },
            })
          );
          if (payload.done) {
            source.close();
            moveEvalSourcesRef.current[move.ply] = null;
          }
        } catch {
          // ignore malformed messages
        }
      };
      source.onerror = () => {
        setMoveEvaluations((prev) => ({
          ...prev,
          [move.ply]: { status: "error", error: "Engine stream error" },
        }));
        source.close();
        moveEvalSourcesRef.current[move.ply] = null;
      };
    },
    [API_BASE_URL]
  );

  const resetReviewState = useCallback(() => {
    Object.values(moveEvalSourcesRef.current).forEach((source) => source?.close());
    moveEvalSourcesRef.current = {};
    setPlayerClock(null);
    setAnalysisReady(false);
    setTimeline([]);
    setCurrentMoveIndex(-1);
    setMoveEvaluations({});
    setBookStatusByPly({});
    bookCacheRef.current = {};
    setPlayerNames({ white: "White", black: "Black" });
    setLastEvaluationDisplay(null);
    setIsAutoPlaying(false);
    setPgnInput("");
    setAnalysisError(null);
    setInputError(null);
    setGameResult(null);
    setFallbackOpening(null);
    setHeaderEndTime(null);
    setFullReviewDone(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(REVIEW_STORAGE_KEY);
      window.localStorage.removeItem(PLAYER_NAMES_STORAGE_KEY);
      window.localStorage.removeItem(PLAYER_CLOCK_STORAGE_KEY);
    }
  }, []);

  const bootstrapTimeline = useCallback((moves: MoveSnapshot[]) => {
    Object.values(moveEvalSourcesRef.current).forEach((source) => source?.close());
    moveEvalSourcesRef.current = {};
    setTimeline(moves);
    setCurrentMoveIndex(moves.length ? 0 : -1);
    const map: Record<number, MoveEvalState> = {};
    map[startingSnapshot.ply] = { status: "idle" };
    moves.forEach((move) => {
      map[move.ply] = { status: "idle" };
    });
    setMoveEvaluations(map);
    setBookStatusByPly({});
    bookCacheRef.current = {};
    setLastEvaluationDisplay(null);
    setIsAutoPlaying(false);
  }, [startingSnapshot]);

  useEffect(() => {
    return () => {
      resetReviewState();
    };
  }, [resetReviewState]);

  const runAnalysis = useCallback(
    async (rawPgn: string, openingHint?: string | null) => {
      const trimmed = rawPgn.trim();
      if (!trimmed) return;
      setInputError(null);
      setAnalysisError(null);
      setAnalysisReady(false);
      setTimeline([]);
      setCurrentMoveIndex(-1);
      setMoveEvaluations({});
      setBookStatusByPly({});
      setLastEvaluationDisplay(null);
      setIsAutoPlaying(false);
      setFullReviewDone(false);
      bookCacheRef.current = {};
      const tags = extractTagsFromPgn(trimmed);
      const openingFromTags = tags.opening ?? tags.variation ?? null;
      const openingResolved = openingFromTags ?? openingHint ?? fallbackOpening;
      const normalizedOpening = normalizeOpeningLabel(openingResolved);
      setFallbackOpening(normalizedOpening);
      if (tags.utcDate || tags.utcTime) {
        const normalizedDate = tags.utcDate?.replace(/\./g, "-") ?? null;
        const iso = normalizedDate ? `${normalizedDate}T${tags.utcTime ?? "00:00:00"}Z` : null;
        const parsed = iso ? Date.parse(iso) : NaN;
        if (!Number.isNaN(parsed)) {
          setHeaderEndTime(Math.floor(parsed / 1000));
        }
      }
      let parsedMoves: MoveSnapshot[] = [];
      try {
        parsedMoves = buildTimelineFromPgn(trimmed);
      } catch (err) {
        setInputError(getErrorMessage(err, "Invalid PGN"));
        return;
      }

      if (!parsedMoves.length) {
        setInputError("Game must contain at least one move");
        return;
      }

      const metadata = getGameResultFromPgn(trimmed);
      setGameResult(metadata);
      const startingClock = parseStartingClock(trimmed);
      if (startingClock) {
        setPlayerClock(startingClock);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PLAYER_CLOCK_STORAGE_KEY, startingClock);
        }
      }
      setPgnInput(trimmed);

      const timelineResult = parsedMoves.map((move) => ({ ...move }));
      bootstrapTimeline(timelineResult);
      setAnalysisReady(true);
      setAnalysisKey((prev) => prev + 1);
      const extractedNames = getPlayerNamesFromPgn(trimmed);
      setPlayerNames(extractedNames);
    },
    [bootstrapTimeline, fallbackOpening]
  );

  const runFullReview = useCallback(
    async () => {
      if (!pgnInput.trim() || !timeline.length) return;
      setAnalysisLoading(true);
      setAnalysisError(null);
      try {
        const parsedMoves = buildTimelineFromPgn(pgnInput);
        const response = await fetch(`${API_BASE_URL}/api/review/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pgn: pgnInput.trim(),
            depth: 16,
            samples: Math.min(parsedMoves.length, 10),
          }),
        });
        const payload: GameAnalysisResponse | { error: string } = await response.json();
        if (!response.ok || "error" in payload) {
          throw new Error("error" in payload ? payload.error : "Failed to analyze game");
        }

        const timelineFromServer = payload.timeline ?? parsedMoves;
        const timelineResult = timelineFromServer.map((move, index) => {
          const parsedMove = parsedMoves[index];
          if (!parsedMove) return move;
          return { ...parsedMove, ...move, clock: move.clock ?? parsedMove.clock };
        });
        bootstrapTimeline(timelineResult);
        setMoveEvaluations((prev) => mergeSampleEvaluations(prev, payload.samples));
        setFullReviewDone(true);
        setAnalysisKey((prev) => prev + 1);
      } catch (err) {
        setAnalysisError(getErrorMessage(err, "Failed to run analysis"));
      } finally {
        setAnalysisLoading(false);
      }
    },
    [API_BASE_URL, bootstrapTimeline, pgnInput, timeline.length]
  );

  const handleAnalyze = () => {
    void runAnalysis(pgnInput);
  };

  useEffect(() => {
    const state = location.state as {
      pgn?: string;
      players?: { white: string; black: string };
      clock?: string | null;
      opening?: string | null;
      endTime?: number | null;
    } | null;
    if (state?.players) {
      setPlayerNames({
        white: state.players.white || "White",
        black: state.players.black || "Black",
      });
    }
    if (state?.opening) {
      setFallbackOpening(state.opening);
    }
    if (typeof state?.endTime === "number") {
      setHeaderEndTime(state.endTime);
    }
    if (typeof state?.clock !== "undefined") {
      setPlayerClock(state.clock || null);
    }
    if (state?.pgn) {
      void runAnalysis(state.pgn, state.opening ?? null);
      navigate(".", { replace: true, state: null });
    }
  }, [location.state, navigate, runAnalysis]);

  useEffect(() => {
    return () => {
      Object.values(moveEvalSourcesRef.current).forEach((source) => source?.close());
      moveEvalSourcesRef.current = {};
    };
  }, []);

  const handleSelectMove = useCallback(
    (index: number) => {
      if (index < -1 || index > timeline.length - 1) return;
      setCurrentMoveIndex(index);
      if (index >= 0) {
        const move = timeline[index];
        const state = moveEvaluations[move.ply];
        if (!state || state.status === "error") {
          requestEvaluation(move);
        }
      }
    },
    [moveEvaluations, requestEvaluation, timeline]
  );

  const ensureMoveEvaluation = useCallback(
    (move: MoveSnapshot | null) => {
      if (!move) return;
      const state = moveEvaluations[move.ply];
      if (!state || state.status === "idle") {
        requestEvaluation(move);
      }
    },
    [moveEvaluations, requestEvaluation]
  );

  useEffect(() => {
    if (!timeline.length) return;
    if (currentMoveIndex >= 0) {
      const currentMove = timeline[currentMoveIndex];
      ensureMoveEvaluation(currentMove ?? null);
      const previousSnapshot = currentMoveIndex === 0 ? startingSnapshot : timeline[currentMoveIndex - 1];
      ensureMoveEvaluation(previousSnapshot ?? null);
    } else if (timeline.length > 0) {
      ensureMoveEvaluation(startingSnapshot);
    }
  }, [currentMoveIndex, timeline, ensureMoveEvaluation, startingSnapshot]);

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
        handleSelectMove(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        handleSelectMove(timeline.length - 1);
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

  const fetchBookPosition = useCallback(
    async (fen: string): Promise<BookPositionInfo | null> => {
      if (!fen) return null;
      if (fen in bookCacheRef.current) {
        return bookCacheRef.current[fen];
      }
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/review/book?fen=${encodeURIComponent(fen)}&moves=10`
        );
        if (!response.ok) {
          throw new Error(`Book lookup failed (${response.status})`);
        }
        const payload = (await response.json()) as BookPositionInfo;
        bookCacheRef.current[fen] = payload;
        return payload;
      } catch {
        bookCacheRef.current[fen] = null;
        return null;
      }
    },
    []
  );

  useEffect(() => {
    if (!analysisReady || !timeline.length) {
      setBookStatusByPly({});
      return;
    }
    let cancelled = false;
    const determineBookMoves = async () => {
      const updates: Record<number, BookMoveStatus> = {};
      let prevFen = initialFen;
      let exited = false;
      let lastOpening: { eco?: string; name?: string } | undefined;
      for (let i = 0; i < timeline.length; i++) {
        const move = timeline[i];
        if (exited) {
          updates[move.ply] = { inBook: false };
          continue;
        }
        const prevPosition = await fetchBookPosition(prevFen);
        if (cancelled) return;
        const moveUci = move.uci || deriveUciFromSan(prevFen, move.san);
        const match = prevPosition?.moves?.find((bm) => bm.uci === moveUci);
        const currentPosition = await fetchBookPosition(move.fen);
        if (cancelled) return;
        const currentOpening = currentPosition?.opening ?? prevPosition?.opening ?? lastOpening;
        if (!match) {
          updates[move.ply] = {
            inBook: false,
            eco: currentOpening?.eco,
            opening: currentOpening?.name,
          };
          exited = true;
          continue;
        }
        updates[move.ply] = {
          inBook: true,
          eco: currentOpening?.eco,
          opening: currentOpening?.name,
          moveStats: match,
        };
        lastOpening = currentOpening;
        prevFen = move.fen;
      }
      if (!cancelled) {
        setBookStatusByPly((prev) => ({ ...prev, ...updates }));
      }
    };
    determineBookMoves();
    return () => {
      cancelled = true;
    };
  }, [analysisReady, timeline, initialFen, fetchBookPosition]);

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
          {!analysisReady && !analysisLoading && (
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
          {showAnalysisModal && (
            <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 transition-opacity duration-300 ${analysisLoading ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <div className={`bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-xl p-8 space-y-4 text-center transform transition-all duration-300 ${analysisLoading ? "scale-100" : "scale-95"}`}>
                <h3 className="text-2xl font-semibold text-gray-900">Analyzing Game</h3>
                <p className="text-sm text-gray-500">Preparing engine insights and move timelines…</p>
                <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-[#00bfa6] transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(loadingProgress, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {analysisReady && !analysisLoading && !showAnalysisModal && selectedView === "analysis" && (
            <section
              key={analysisKey}
              className="fade-in w-full"
            >
              <div
                className="hidden xl:grid items-start mx-auto"
                style={{ gridTemplateColumns: `360px ${boardCardWidth}px 360px`, gap: "2rem", justifyContent: "center" }}
              >
                <div className="flex flex-col gap-6">
                  {gameHeaderCard}
                  <MoveListCard
                    movePairs={movePairs}
                    currentMoveIndex={currentMoveIndex}
                    onSelectMove={handleSelectMove}
                    moveClassifications={moveClassifications}
                    bookStatuses={bookStatusByPly}
                  />
                </div>
                <div className="flex flex-col gap-4 items-center" style={{ width: boardCardWidth }}>
                  <BoardAnalysisCard
                    boardPosition={boardPosition}
                    boardWidth={boardSize}
                    boardOrientation={boardOrientation}
                    boardColors={BOARD_THEMES[boardTheme]}
                    lastMove={lastMoveSquares}
                    lastMoveColor={lastMoveColor}
                    evaluationPercent={evaluationPercent}
                    currentEvaluationScore={currentEvaluationScore}
                    whiteLabel={whiteHeaderLabel}
                    blackLabel={blackHeaderLabel}
                    whiteClock={whiteClockDisplay}
                    blackClock={blackClockDisplay}
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
                </div>
                <div className="flex flex-col gap-6">
                  {fullReviewDone ? (
                    <MoveQualityCard
                      move={currentMove}
                      classification={currentMoveClassification}
                      awaitingEvaluation={Boolean(currentMove && !currentMoveClassification && !bookStatusByPly[currentMove.ply])}
                      bookStatus={currentMove ? bookStatusByPly[currentMove.ply] : undefined}
                    />
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow p-5 space-y-3">
                      <p className="text-lg font-semibold text-gray-900">Review this game</p>
                      <p className="text-sm text-gray-600">
                        See classifications after a full review. Top engine lines are available now.
                      </p>
                      <button
                        onClick={() => void runFullReview()}
                        className="inline-flex items-center justify-center rounded-xl bg-[#00bfa6] text-white px-4 py-2 font-semibold shadow hover:bg-[#00a48f] transition disabled:opacity-60"
                        disabled={analysisLoading}
                      >
                        {analysisLoading ? "Reviewing…" : "Review Game"}
                      </button>
                    </div>
                  )}
                  <EngineAnalysisCard
                    engineStatus={engineStatus}
                    engineError={engineError}
                    stableEvaluation={stableEvaluation}
                    drawInfo={drawInfo}
                  />
                </div>
              </div>

              <div className="xl:hidden flex flex-col gap-4 items-center w-full">
                <BoardAnalysisCard
                  boardPosition={boardPosition}
                  boardWidth={boardSize}
                  boardOrientation={boardOrientation}
                  boardColors={BOARD_THEMES[boardTheme]}
                  lastMove={lastMoveSquares}
                  lastMoveColor={lastMoveColor}
                  evaluationPercent={evaluationPercent}
                  currentEvaluationScore={currentEvaluationScore}
                  whiteLabel={whiteHeaderLabel}
                  blackLabel={blackHeaderLabel}
                  whiteClock={whiteClockDisplay}
                  blackClock={blackClockDisplay}
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
              </div>

              <div className="xl:hidden space-y-6 mt-8">
                {gameHeaderCard}
                <MoveListCard
                  movePairs={movePairs}
                  currentMoveIndex={currentMoveIndex}
                  onSelectMove={handleSelectMove}
                  moveClassifications={moveClassifications}
                  bookStatuses={bookStatusByPly}
                />
                {fullReviewDone ? (
                  <MoveQualityCard
                    move={currentMove}
                    classification={currentMoveClassification}
                    awaitingEvaluation={Boolean(currentMove && !currentMoveClassification && !bookStatusByPly[currentMove.ply])}
                    bookStatus={currentMove ? bookStatusByPly[currentMove.ply] : undefined}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow p-5 space-y-3">
                    <p className="text-lg font-semibold text-gray-900">Review this game</p>
                    <p className="text-sm text-gray-600">
                      See classifications after a full review. Top engine lines are available now.
                    </p>
                    <button
                      onClick={() => void runFullReview()}
                      className="inline-flex items-center justify-center rounded-xl bg-[#00bfa6] text-white px-4 py-2 font-semibold shadow hover:bg-[#00a48f] transition disabled:opacity-60"
                      disabled={analysisLoading}
                    >
                      {analysisLoading ? "Reviewing…" : "Review Game"}
                    </button>
                  </div>
                )}
              <EngineAnalysisCard
                engineStatus={engineStatus}
                engineError={engineError}
                stableEvaluation={stableEvaluation}
                drawInfo={drawInfo}
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

function getEvaluationSnapshot(state?: MoveEvalState): EngineEvaluation | undefined {
  if (!state) return undefined;
  if (state.status === "success") return state.evaluation;
  if (state.status === "loading" && state.previous) return state.previous;
  return undefined;
}

function isForcedMove(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    return chess.moves().length <= 1;
  } catch {
    return false;
  }
}

function deriveUciFromSan(fen: string, san: string): string | undefined {
  try {
    const chess = new Chess(fen);
    const candidates = chess.moves({ verbose: true });
    const match = candidates.find((move) => move.san === san);
    if (!match) return undefined;
    return `${match.from}${match.to}${match.promotion ?? ""}`;
  } catch {
    return undefined;
  }
}

function getPlayerNamesFromPgn(pgn: string): { white: string; black: string } {
  const whiteMatch = pgn.match(/\[White\s+"([^"]+)"\]/i);
  const blackMatch = pgn.match(/\[Black\s+"([^"]+)"\]/i);
  return {
    white: whiteMatch?.[1]?.trim() || "White",
    black: blackMatch?.[1]?.trim() || "Black",
  };
}

function extractTagsFromPgn(pgn: string): {
  whiteElo: string | null;
  blackElo: string | null;
  timeControl: string | null;
  date: string | null;
  utcDate: string | null;
  utcTime: string | null;
  opening: string | null;
  variation: string | null;
} {
  const getTag = (name: string) => {
    const match = pgn.match(new RegExp(`\\[${name}\\s+"([^"]+)"\\]`, "i"));
    return match?.[1]?.trim() ?? null;
  };
  return {
    whiteElo: getTag("WhiteElo"),
    blackElo: getTag("BlackElo"),
    timeControl: getTag("TimeControl"),
    date: getTag("Date") ?? getTag("UTCDate"),
    utcDate: getTag("UTCDate"),
    utcTime: getTag("UTCTime"),
    opening: getTag("Opening"),
    variation: getTag("Variation"),
  };
}

function normalizeOpeningLabel(raw?: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith("http")) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const slug = parts[parts.length - 1] || parts[parts.length - 2] || trimmed;
      const decoded = decodeURIComponent(slug);
      const tokens = decoded.replace(/[-_]/g, " ").split(/\s+/);
      const filtered = tokens.filter((token) => token && !/\d/.test(token));
      const label = filtered.join(" ").trim();
      return label || trimmed;
    }
  } catch {
    // ignore URL parse errors and fall back to trimmed
  }

  return trimmed;
}

function getGameResultFromPgn(pgn: string): GameResultInfo | null {
  if (!pgn) return null;
  const resultMatch = pgn.match(/\[Result\s+"([^"]+)"\]/i);
  if (!resultMatch) return null;
  const result = resultMatch[1]?.trim();
  if (!result || result === "*") return null;
  const terminationMatch = pgn.match(/\[Termination\s+"([^"]+)"\]/i);
  return {
    result,
    termination: terminationMatch?.[1],
  };
}

function formatResultLabel(result?: string | null) {
  if (!result) return "In progress";
  if (result === "1-0") return "White wins";
  if (result === "0-1") return "Black wins";
  if (result === "1/2-1/2") return "Draw";
  return "In progress";
}

function formatTimeControlLabel(raw: string | null) {
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
        : `${parseFloat((minutes).toFixed(2))}`;
  const incLabel = Number.isFinite(incSeconds) ? `${incSeconds}` : incPart;
  return `${baseLabel}+${incLabel}`;
}

function formatUtcDateLabel({
  utcDate,
  utcTime,
  fallbackEpochSeconds,
}: {
  utcDate: string | null;
  utcTime: string | null;
  fallbackEpochSeconds: number | null;
}) {
  const buildFromUtcTags = () => {
    if (!utcDate) return null;
    const normalizedDate = utcDate.replace(/\./g, "-");
    const time = utcTime ?? "00:00:00";
    const iso = `${normalizedDate}T${time}Z`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  };

  const fromTags = buildFromUtcTags();
  const date = fromTags ?? (fallbackEpochSeconds ? new Date(fallbackEpochSeconds * 1000) : null);
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
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
