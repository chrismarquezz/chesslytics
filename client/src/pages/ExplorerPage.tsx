import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import Navbar from "../components/Navbar";
import type { BoardThemeKey, EngineEvaluation, EngineScore, MoveSnapshot } from "../types/review";
import { getEvalPercent, getMateWinner, UCI_MOVE_REGEX } from "../utils/reviewEngine";
import MoveListCard, { type MovePair } from "../components/review/MoveListCard";
import ExplorerBoardCard from "../components/explorer/ExplorerBoardCard";
import EngineAnalysisCard from "../components/review/EngineAnalysisCard";
import ThemeSelectorModal from "../components/review/ThemeSelectorModal";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:5100";

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
  sunset: { light: "#ffe8d9", dark: "#f5a962", label: "Sunset" },
  midnight: { light: "#e8ecf5", dark: "#2f3d55", label: "Midnight" },
  rose: { light: "#fde9f1", dark: "#f0a4c1", label: "Rose" },
};

interface EvaluationDisplay {
  evaluation: EngineEvaluation;
  fen: string;
}

type ExplorerEvalState =
  | { status: "idle" }
  | { status: "loading"; previous?: EvaluationDisplay }
  | { status: "success"; evaluation: EvaluationDisplay }
  | { status: "error"; error: string; previous?: EvaluationDisplay };

const EXPLORER_MOVE_ROWS = 30;

export default function ExplorerPage() {
  const chessRef = useRef(new Chess());
  const [boardSize, setBoardSize] = useState(600);
  const [currentFen, setCurrentFen] = useState(chessRef.current.fen());
  const [history, setHistory] = useState<MoveSnapshot[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [evaluationState, setEvaluationState] = useState<ExplorerEvalState>({ status: "idle" });
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationDisplay | null>(null);
  const evaluationSourceRef = useRef<EventSource | null>(null);
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [engineLinesCount, setEngineLinesCount] = useState(3);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("chesslab-theme") as BoardThemeKey | null;
      if (stored && stored in BOARD_THEMES) {
        return stored;
      }
    }
    return "modern";
  });
  const pieceFolders = useMemo(() => {
    const glob = import.meta.glob("../../public/pieces/*/wK.svg", { eager: true, as: "url" });
    const names = Object.keys(glob)
      .map((path) => {
        const parts = path.split("/");
        const idx = parts.findIndex((p) => p === "pieces");
        return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null;
      })
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(names));
  }, []);
  const [pieceTheme, setPieceTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("chesslab-piece-theme");
      if (stored) return stored;
    }
    return pieceFolders.includes("cburnett") ? "cburnett" : pieceFolders[0] ?? "merida_new";
  });

  useEffect(() => {
    const resize = () => {
      if (typeof window === "undefined") return;
      const width = window.innerWidth;
      setBoardSize(Math.max(360, Math.min(640, width - 72)));
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("chesslab-theme", boardTheme);
  }, [boardTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("chesslab-piece-theme", pieceTheme);
  }, [pieceTheme]);

  const pieceOptions = useMemo(
    () => Array.from(new Set([...(pieceFolders.length ? pieceFolders : ["modern"]), pieceTheme])),
    [pieceFolders, pieceTheme]
  );
  const customPieces = useMemo(
    () =>
      Object.fromEntries(
        ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"].map((code) => [
          code,
          () => <img src={`/pieces/${pieceTheme}/${code}.svg`} alt={code} className="w-full h-full" />,
        ])
      ),
    [pieceTheme]
  );

  const movePairs = useMemo<MovePair[]>(() => {
    const pairs: MovePair[] = [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push({
        moveNumber: history[i].moveNumber,
        white: history[i],
        black: history[i + 1],
        whiteIndex: i,
        blackIndex: i + 1,
      });
    }
    return pairs;
  }, [history]);

  const displayMovePairs = useMemo<MovePair[]>(() => {
    const totalRows = Math.max(movePairs.length, EXPLORER_MOVE_ROWS);
    const rows: MovePair[] = [];
    for (let i = 0; i < totalRows; i++) {
      if (i < movePairs.length) {
        rows.push(movePairs[i]);
      } else {
        rows.push({
          moveNumber: i + 1,
          white: undefined,
          black: undefined,
          whiteIndex: -1,
          blackIndex: -1,
        });
      }
    }
    return rows;
  }, [movePairs]);

  const runEvaluation = useCallback(
    (fen: string) => {
      if (!fen || typeof window === "undefined") return;
      setEvaluationState((prev) => ({
        status: "loading",
        previous:
          prev.status === "success"
            ? prev.evaluation
            : prev.status === "loading"
              ? prev.previous
              : lastEvaluation ?? undefined,
      }));
      evaluationSourceRef.current?.close();
      const source = new EventSource(
        `${API_BASE_URL}/api/review/evaluate/stream?fen=${encodeURIComponent(fen)}&depth=22`
      );
      evaluationSourceRef.current = source;
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { evaluation?: EngineEvaluation; done?: boolean; error?: string };
          if (payload.error) {
            setEvaluationState({
              status: "error",
              error: payload.error || "Engine stream error",
              previous: lastEvaluation ?? undefined,
            });
            source.close();
            if (evaluationSourceRef.current === source) {
              evaluationSourceRef.current = null;
            }
            return;
          }
          if (payload.evaluation) {
            const display: EvaluationDisplay = { evaluation: payload.evaluation, fen };
            setLastEvaluation(display);
            setEvaluationState({ status: "success", evaluation: display });
          }
          if (payload.done) {
            source.close();
            if (evaluationSourceRef.current === source) {
              evaluationSourceRef.current = null;
            }
          }
        } catch {
          // ignore malformed messages
        }
      };
      source.onerror = () => {
        setEvaluationState((prev) => ({
          status: "error",
          error: "Engine stream error",
          previous:
            prev.status === "success"
              ? prev.evaluation
              : prev.status === "loading"
                ? prev.previous
                : lastEvaluation ?? undefined,
        }));
        source.close();
        if (evaluationSourceRef.current === source) {
          evaluationSourceRef.current = null;
        }
      };
      return () => {
        source.close();
        if (evaluationSourceRef.current === source) {
          evaluationSourceRef.current = null;
        }
      };
    },
    [API_BASE_URL, lastEvaluation]
  );

  useEffect(() => {
    const abort = runEvaluation(currentFen);
    return () => {
      abort?.();
    };
  }, [currentFen, runEvaluation]);

  useEffect(() => {
    return () => {
      evaluationSourceRef.current?.close();
      evaluationSourceRef.current = null;
    };
  }, []);

  const rebuildHistoryFromGame = useCallback(() => {
    const game = chessRef.current;
    const verboseMoves = game.history({ verbose: true }) as Move[];
    const snapshots: MoveSnapshot[] = [];
    const replay = new Chess();
    verboseMoves.forEach((mv, index) => {
      replay.move(mv);
      snapshots.push({
        ply: index + 1,
        moveNumber: Math.floor(index / 2) + 1,
        san: mv.san,
        color: mv.color === "w" ? "white" : "black",
        fen: replay.fen(),
        uci: `${mv.from}${mv.to}${mv.promotion ?? ""}`,
      });
    });
    setHistory(snapshots);
    setCurrentFen(game.fen());
  }, []);

  const applyMove = useCallback((from: Square, to: Square) => {
    const game = chessRef.current;
    const promotion = getPromotionPiece(game, from, to);
    const move = game.move({ from, to, promotion });
    if (!move) return false;
    setHistory((prev) => [
      ...prev,
      {
        ply: prev.length + 1,
        moveNumber: Math.floor(prev.length / 2) + 1,
        san: move.san,
        color: move.color === "w" ? "white" : "black",
        fen: game.fen(),
        uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      },
    ]);
    setCurrentFen(game.fen());
    setSelectedSquare(null);
    return true;
  }, []);

  const handleDrop = useCallback(
    (source: Square, target: Square, _piece: string) => {
      return applyMove(source, target);
    },
    [applyMove]
  );

  const handleSquareClick = useCallback(
    (square: Square) => {
      const game = chessRef.current;
      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null);
          return;
        }
        const selectedPiece = game.get(selectedSquare);
        const targetPiece = game.get(square);
        if (selectedPiece && targetPiece && selectedPiece.color === targetPiece.color) {
          setSelectedSquare(square);
          return;
        }
        const moved = applyMove(selectedSquare, square);
        if (!moved) {
          if (targetPiece && targetPiece.color === game.turn()) {
            setSelectedSquare(square);
          } else {
            setSelectedSquare(null);
          }
        }
        return;
      }
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    },
    [applyMove, selectedSquare]
  );

  const handleUndo = () => {
    const game = chessRef.current;
    const undone = game.undo();
    if (!undone) return;
    rebuildHistoryFromGame();
    setSelectedSquare(null);
  };

  const handleReset = () => {
    chessRef.current.reset();
    setHistory([]);
    setCurrentFen(chessRef.current.fen());
    evaluationSourceRef.current?.close();
    evaluationSourceRef.current = null;
    setEvaluationState({ status: "idle" });
    setLastEvaluation(null);
    setSelectedSquare(null);
  };

  const displayedEvaluation =
    evaluationState.status === "success"
      ? evaluationState.evaluation
      : evaluationState.status === "loading"
        ? evaluationState.previous ?? lastEvaluation
        : evaluationState.status === "error"
          ? evaluationState.previous ?? lastEvaluation
          : lastEvaluation;

  const currentScore: EngineScore | null = displayedEvaluation?.evaluation.score ?? null;
  const currentMateWinner = displayedEvaluation ? getMateWinner(currentScore, displayedEvaluation.fen) : undefined;
  const evaluationPercent = displayedEvaluation ? getEvalPercent(currentScore, currentMateWinner) : 0.5;
  const arrows = useMemo(() => {
    if (!showBestMoveArrow || !displayedEvaluation?.evaluation.bestMove) return [] as Array<[Square, Square]>;
    const arrow = getArrowFromBestMove(displayedEvaluation.evaluation.bestMove);
    return arrow ? [arrow] : [];
  }, [displayedEvaluation, showBestMoveArrow]);

  const boardCardWidth = Math.max(boardSize + 48, 360);
  const boardColors = BOARD_THEMES[boardTheme];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 text-gray-800 px-6 py-6 pl-24 md:pl-28">
        <div className="max-w-6xl mx-auto space-y-8">
          <section className="w-full">
            <div
              className="hidden xl:grid items-start mx-auto"
              style={{ gridTemplateColumns: `360px ${boardCardWidth}px 360px`, gap: "2rem", justifyContent: "center" }}
            >
              <div className="flex flex-col gap-4">
                <MoveListCard
                  movePairs={displayMovePairs}
                  currentMoveIndex={history.length - 1}
                  onSelectMove={() => undefined}
                  moveClassifications={{}}
                  bookStatuses={{}}
                />
              </div>
              <ExplorerBoardCard
                boardPosition={currentFen}
                boardWidth={boardSize}
                boardOrientation={boardOrientation}
                boardColors={boardColors}
                customPieces={customPieces}
                evaluationPercent={evaluationPercent}
                currentEvaluationScore={currentScore}
                bestMoveArrows={arrows}
                showBestMoveArrow={showBestMoveArrow}
                canUndo={history.length > 0}
                onPieceDrop={handleDrop}
                onSquareClick={handleSquareClick}
                onUndo={handleUndo}
                onReset={handleReset}
                onFlipBoard={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                onToggleBestMoveArrow={() => setShowBestMoveArrow((prev) => !prev)}
                onOpenThemeModal={() => setIsThemeModalOpen(true)}
                selectedSquare={selectedSquare}
              />
              <div className="flex flex-col gap-6">
                <EngineAnalysisCard
                  engineStatus={evaluationState.status}
                  engineError={evaluationState.status === "error" ? evaluationState.error : null}
                  stableEvaluation={displayedEvaluation}
                  linesToShow={engineLinesCount}
                />
              </div>
            </div>

            <div className="xl:hidden flex flex-col gap-6 items-center w-full">
              <ExplorerBoardCard
                boardPosition={currentFen}
                boardWidth={boardSize}
                boardOrientation={boardOrientation}
                boardColors={boardColors}
                customPieces={customPieces}
                evaluationPercent={evaluationPercent}
                currentEvaluationScore={currentScore}
                bestMoveArrows={arrows}
                showBestMoveArrow={showBestMoveArrow}
                canUndo={history.length > 0}
                onPieceDrop={handleDrop}
                onSquareClick={handleSquareClick}
                onUndo={handleUndo}
                onReset={handleReset}
                onFlipBoard={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                onToggleBestMoveArrow={() => setShowBestMoveArrow((prev) => !prev)}
                onOpenThemeModal={() => setIsThemeModalOpen(true)}
                selectedSquare={selectedSquare}
              />
              <MoveListCard
                movePairs={displayMovePairs}
                currentMoveIndex={history.length - 1}
                onSelectMove={() => undefined}
                moveClassifications={{}}
                bookStatuses={{}}
              />
              <EngineAnalysisCard
                engineStatus={evaluationState.status}
                engineError={evaluationState.status === "error" ? evaluationState.error : null}
                stableEvaluation={displayedEvaluation}
                linesToShow={engineLinesCount}
              />
            </div>
          </section>
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
        pvCount={engineLinesCount}
        onChangePvCount={(value) => setEngineLinesCount(value)}
        pieceTheme={pieceTheme}
        pieceOptions={pieceOptions}
        onSelectPiece={(key) => setPieceTheme(key || (pieceFolders[0] ?? "modern"))}
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

function getPromotionPiece(game: Chess, from: Square, to: Square): "q" | undefined {
  try {
    const piece = game.get(from);
    if (!piece || piece.type !== "p") return undefined;
    if (piece.color === "w" && to[1] === "8") return "q";
    if (piece.color === "b" && to[1] === "1") return "q";
    return undefined;
  } catch {
    return undefined;
  }
}
