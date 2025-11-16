import type { EngineEvaluation, MoveEvalState } from "../../types/review";
import { formatBestMoveSan, formatLineContinuation, formatScore, getMateWinner } from "../../utils/reviewEngine";

interface EngineAnalysisCardProps {
  engineStatus?: MoveEvalState["status"];
  engineError: string | null;
  stableEvaluation: { evaluation: EngineEvaluation; fen?: string } | null;
  currentMoveNumber?: number;
}

export default function EngineAnalysisCard({
  engineStatus,
  engineError,
  stableEvaluation,
  currentMoveNumber,
}: EngineAnalysisCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow hover:shadow-2xl transition-all duration-300 p-5 flex flex-col h-[360px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Engine</h2>
        <span className="text-xs uppercase tracking-wide text-gray-500">
          {currentMoveNumber ? `Move ${currentMoveNumber}` : "Initial position"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {engineStatus === "error" && !stableEvaluation ? (
          <p className="text-sm text-red-500">Engine error: {engineError || "Unable to evaluate position."}</p>
        ) : !stableEvaluation ? (
          <p className="text-sm text-gray-500">Analyzing current position…</p>
        ) : (
          <EngineLines evaluation={stableEvaluation.evaluation} fen={stableEvaluation.fen} />
        )}
      </div>
    </div>
  );
}

function EngineLines({ evaluation, fen }: { evaluation: EngineEvaluation; fen?: string }) {
  const lines = (evaluation.lines && evaluation.lines.length
    ? evaluation.lines
    : [
        {
          move: evaluation.bestMove,
          score: evaluation.score,
          pv: evaluation.pv,
        },
      ]
  ).slice(0, 3);

  const mateWinner =
    evaluation.score?.type === "mate" && evaluation.score.value === 0 ? getMateWinner(evaluation.score, fen) : undefined;
  if (mateWinner) {
    const mateResult = mateWinner === "White" ? "1-0" : "0-1";
    const winnerText = `Checkmate for ${mateWinner}`;
    return (
      <div className="text-center">
        <p className="text-3xl font-bold text-gray-900">{mateResult}</p>
        <p className="text-sm text-gray-500 mt-1">{winnerText}</p>
      </div>
    );
  }

  if (!lines.length) {
    return <p className="text-sm text-gray-500">No engine suggestions available for this position.</p>;
  }

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const moveSan = formatBestMoveSan(line.move, fen);
        const mainLine = formatLineContinuation(line, fen);
        return (
          <div
            key={`${line.move}-${index}`}
            className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3"
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">#{index + 1}</p>
              <p className="text-lg font-semibold text-gray-900">{moveSan}</p>
              {mainLine && <p className="text-xs text-gray-500">{mainLine}</p>}
            </div>
            <div className="text-right text-sm font-semibold text-gray-700">
              {line.score ? formatScore(line.score) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
