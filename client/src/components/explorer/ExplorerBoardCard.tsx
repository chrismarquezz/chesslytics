import { Chessboard } from "react-chessboard";
import { ArrowUpDown, CornerUpLeft, Lightbulb, RotateCcw, Settings } from "lucide-react";
import type { CSSProperties } from "react";
import type { Square } from "chess.js";
import type { Arrow, EngineScore } from "../../types/review";
import BoardControlButton from "../review/BoardControlButton";
import EvaluationBar from "../review/EvaluationBar";

interface ExplorerBoardCardProps {
  boardPosition: string;
  boardWidth: number;
  boardOrientation: "white" | "black";
  boardColors: { light: string; dark: string };
  customPieces?: Record<string, (props: { squareWidth: number }) => JSX.Element>;
  evaluationPercent: number;
  currentEvaluationScore: EngineScore | null;
  bestMoveArrows: Arrow[];
  showBestMoveArrow: boolean;
  canUndo: boolean;
  onPieceDrop: (sourceSquare: Square, targetSquare: Square, piece: string) => boolean;
  onSquareClick: (square: Square) => void;
  onUndo: () => void;
  onReset: () => void;
  onFlipBoard: () => void;
  onToggleBestMoveArrow: () => void;
  onOpenThemeModal: () => void;
  selectedSquare: Square | null;
}

export default function ExplorerBoardCard({
  boardPosition,
  boardWidth,
  boardOrientation,
  boardColors,
  customPieces,
  evaluationPercent,
  currentEvaluationScore,
  bestMoveArrows,
  showBestMoveArrow,
  canUndo,
  onPieceDrop,
  onSquareClick,
  onUndo,
  onReset,
  onFlipBoard,
  onToggleBestMoveArrow,
  onOpenThemeModal,
  selectedSquare,
}: ExplorerBoardCardProps) {
  const cardWidth = Math.max(boardWidth + 48, 360);
  const selectedStyles: Record<string, CSSProperties> = selectedSquare
    ? {
        [selectedSquare]: {
          boxShadow: "inset 0 0 0 3px rgba(14,165,233,0.9)",
          borderRadius: "0",
        },
      }
    : {};

  return (
    <div
      className="bg-white shadow-lg rounded-2xl border border-gray-200 p-6 flex flex-col gap-4 items-center"
      style={{ width: cardWidth }}
    >
      <div className="self-stretch">
        <EvaluationBar
          evaluationPercent={evaluationPercent}
          currentEvaluationScore={currentEvaluationScore}
          whiteLabel="White"
          blackLabel="Black"
        />
      </div>
     <div className="flex justify-center">
      <Chessboard
        id="explorer-board"
         position={boardPosition}
         boardWidth={boardWidth}
         boardOrientation={boardOrientation}
         onPieceDrop={onPieceDrop}
         onSquareClick={onSquareClick}
         customDarkSquareStyle={{ backgroundColor: boardColors.dark }}
         customLightSquareStyle={{ backgroundColor: boardColors.light }}
         customBoardStyle={{ borderRadius: 0 }}
         customArrows={bestMoveArrows}
         customSquareStyles={selectedStyles}
         customPieces={customPieces}
       />
      </div>
      <div className="flex flex-wrap gap-3 justify-between border-t border-gray-100 pt-4 w-full">
        <div className="flex gap-2">
          <BoardControlButton onClick={onFlipBoard} label="Flip board">
            <ArrowUpDown className="h-4 w-4" />
          </BoardControlButton>
        </div>
        <div className="flex gap-2">
          <BoardControlButton onClick={onUndo} disabled={!canUndo} label="Undo move">
            <CornerUpLeft className="h-4 w-4" />
          </BoardControlButton>
          <BoardControlButton onClick={onReset} label="Reset board">
            <RotateCcw className="h-4 w-4" />
          </BoardControlButton>
        </div>
        <div className="flex gap-2">
          <BoardControlButton onClick={onToggleBestMoveArrow} active={showBestMoveArrow} label="Best-move hint">
            <Lightbulb className="h-4 w-4" />
          </BoardControlButton>
          <BoardControlButton onClick={onOpenThemeModal} label="Settings">
            <Settings className="h-4 w-4" />
          </BoardControlButton>
        </div>
      </div>
    </div>
  );
}
