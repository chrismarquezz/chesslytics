import type { EngineScore } from "../../types/review";
import { formatScore } from "../../utils/reviewEngine";

interface EvaluationBarProps {
  evaluationPercent: number;
  evaluationSummary: string;
  currentEvaluationScore: EngineScore | null;
}

export default function EvaluationBar({
  evaluationPercent,
  evaluationSummary,
  currentEvaluationScore,
}: EvaluationBarProps) {
  return (
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
  );
}
