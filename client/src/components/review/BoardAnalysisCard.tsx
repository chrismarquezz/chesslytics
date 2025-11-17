import { Chessboard } from "react-chessboard";
import { ArrowUpDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Lightbulb, Palette, Pause, Play } from "lucide-react";
import type { Arrow, EngineScore } from "../../types/review";
import BoardControlButton from "./BoardControlButton";
import EvaluationBar from "./EvaluationBar";

interface BoardAnalysisCardProps {
  boardPosition: string;
  boardWidth: number;
  boardOrientation: "white" | "black";
  boardColors: { light: string; dark: string };
  evaluationPercent: number;
  currentEvaluationScore: EngineScore | null;
  whiteLabel?: string;
  blackLabel?: string;
  bestMoveArrows: Arrow[];
  timelineLength: number;
  currentMoveIndex: number;
  atEnd: boolean;
  isAutoPlaying: boolean;
  showBestMoveArrow: boolean;
  onSelectMove: (index: number) => void;
  onToggleAutoPlay: () => void;
  onFlipBoard: () => void;
  onToggleBestMoveArrow: () => void;
  onOpenThemeModal: () => void;
}

export default function BoardAnalysisCard({
  boardPosition,
  boardWidth,
  boardOrientation,
  boardColors,
  evaluationPercent,
  currentEvaluationScore,
  whiteLabel,
  blackLabel,
  bestMoveArrows,
  timelineLength,
  currentMoveIndex,
  atEnd,
  isAutoPlaying,
  showBestMoveArrow,
  onSelectMove,
  onToggleAutoPlay,
  onFlipBoard,
  onToggleBestMoveArrow,
  onOpenThemeModal,
}: BoardAnalysisCardProps) {
  const hasMoves = timelineLength > 0;
  const cardWidth = boardWidth + 48;

  return (
    <div
      className="bg-white shadow-lg rounded-2xl border border-gray-200 p-6 flex flex-col gap-4 mx-auto"
      style={{ width: Math.max(cardWidth, 360) }}
    >
      <EvaluationBar
        evaluationPercent={evaluationPercent}
        currentEvaluationScore={currentEvaluationScore}
        whiteLabel={whiteLabel}
        blackLabel={blackLabel}
      />
      <div className="flex justify-center">
        <Chessboard
          position={boardPosition}
          boardWidth={boardWidth}
          boardOrientation={boardOrientation}
          arePiecesDraggable={false}
          customDarkSquareStyle={{ backgroundColor: boardColors.dark }}
          customLightSquareStyle={{ backgroundColor: boardColors.light }}
          customBoardStyle={{ borderRadius: 0 }}
          customArrows={bestMoveArrows}
        />
      </div>
      <div className="flex flex-wrap gap-4 items-center border-t border-gray-100 pt-4">
        <div className="flex gap-2 justify-start flex-shrink-0">
          <BoardControlButton onClick={onFlipBoard} disabled={!hasMoves} label="Flip Board">
            <ArrowUpDown className="h-4 w-4" />
          </BoardControlButton>
        </div>
        <div className="flex flex-1 flex-wrap md:flex-nowrap gap-2 justify-center">
          <BoardControlButton onClick={() => onSelectMove(0)} disabled={!hasMoves} label="First move">
            <ChevronFirst className="h-4 w-4" />
          </BoardControlButton>
          <BoardControlButton
            onClick={() => onSelectMove(Math.max(currentMoveIndex - 1, -1))}
            disabled={!hasMoves || currentMoveIndex <= 0}
            label="Previous move"
          >
            <ChevronLeft className="h-4 w-4" />
          </BoardControlButton>
          <BoardControlButton
            onClick={onToggleAutoPlay}
            active={isAutoPlaying}
            disabled={!hasMoves}
            label={isAutoPlaying ? "Pause" : "Play"}
          >
            {isAutoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </BoardControlButton>
          <BoardControlButton
            onClick={() => onSelectMove(Math.min(currentMoveIndex + 1, timelineLength - 1))}
            disabled={!hasMoves || atEnd}
            label="Next move"
          >
            <ChevronRight className="h-4 w-4" />
          </BoardControlButton>
          <BoardControlButton onClick={() => onSelectMove(timelineLength - 1)} disabled={!hasMoves} label="Last move">
            <ChevronLast className="h-4 w-4" />
          </BoardControlButton>
        </div>
        <div className="flex gap-2 justify-end flex-shrink-0">
          <BoardControlButton
            onClick={onToggleBestMoveArrow}
            active={showBestMoveArrow}
            label={showBestMoveArrow ? "Hide Hint" : "Show Hint"}
          >
            <Lightbulb className="h-4 w-4" />
          </BoardControlButton>
          <BoardControlButton onClick={onOpenThemeModal} label="Change Theme">
            <Palette className="h-4 w-4" />
          </BoardControlButton>
        </div>
      </div>
    </div>
  );
}
