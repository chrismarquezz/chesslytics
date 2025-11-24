import { useMemo, useState } from "react";
import type { EngineEvaluation, MoveEvalState } from "../../types/review";
import { formatBestMoveSan, formatLineContinuation, formatScore, getMateWinner } from "../../utils/reviewEngine";

interface EngineAnalysisCardProps {
  engineStatus?: MoveEvalState["status"];
  engineError: string | null;
  stableEvaluation: { evaluation: EngineEvaluation; fen?: string } | null;
  drawInfo?: { result: string; reason?: string };
}

export default function EngineAnalysisCard({
  engineStatus,
  engineError,
  stableEvaluation,
  drawInfo,
}: EngineAnalysisCardProps) {
  const showDraw = Boolean(drawInfo && drawInfo.result === "1/2-1/2");
  const [activeTab, setActiveTab] = useState<"summary" | "analysis" | "time" | "explorer">("analysis");
  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: "summary", label: "Summary" },
    { key: "analysis", label: "Analysis" },
    { key: "time", label: "Time" },
    { key: "explorer", label: "Explorer" },
  ];

  const summaryContent = useMemo(() => {
    if (showDraw) return <DrawSummary reason={drawInfo?.reason} />;
    if (engineStatus === "error" && !stableEvaluation) {
      return <p className="text-sm text-red-500">Engine error: {engineError || "Unable to evaluate position."}</p>;
    }
    if (!stableEvaluation) {
      return <p className="text-sm text-gray-500">Analyzing current position…</p>;
    }
    const scoreLabel = formatScore(stableEvaluation.evaluation.score);
    const bestMove = formatBestMoveSan(stableEvaluation.evaluation.bestMove, stableEvaluation.fen);
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">Score (CP/Mate)</p>
        <p className="text-2xl font-semibold text-gray-900">{scoreLabel}</p>
        <p className="text-sm text-gray-600">Best move</p>
        <p className="text-lg font-semibold text-gray-900">{bestMove}</p>
      </div>
    );
  }, [drawInfo?.reason, engineError, engineStatus, showDraw, stableEvaluation]);

  const timeContent = (
    <div className="text-sm text-gray-500">
      Clock timeline not available in this view yet.
    </div>
  );

  const explorerContent = (
    <div className="text-sm text-gray-500">
      Position explorer coming soon. Use the board controls to navigate moves for now.
    </div>
  );

  return (
    <div className="flex flex-col gap-0">
      <div className="flex w-full border border-gray-200 bg-white rounded-t-2xl overflow-hidden">
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-sm font-semibold py-3 text-center transition ${
                active
                  ? "bg-[#00bfa6]/10 text-gray-900 border-b-2 border-[#00bfa6]"
                  : "text-gray-500"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="bg-white rounded-b-2xl border border-gray-200 border-t-0 shadow transition-all duration-300 flex flex-col h-[380px] px-5 pb-5 pt-4">
        <div className="flex-1 overflow-y-auto">
          {activeTab === "summary" && summaryContent}
          {activeTab === "analysis" &&
            (showDraw ? (
              <DrawSummary reason={drawInfo?.reason} />
            ) : engineStatus === "error" && !stableEvaluation ? (
              <p className="text-sm text-red-500">Engine error: {engineError || "Unable to evaluate position."}</p>
            ) : !stableEvaluation ? (
              <p className="text-sm text-gray-500">Analyzing current position…</p>
            ) : (
              <EngineLines evaluation={stableEvaluation.evaluation} fen={stableEvaluation.fen} />
            ))}
          {activeTab === "time" && timeContent}
          {activeTab === "explorer" && explorerContent}
        </div>
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

function DrawSummary({ reason }: { reason?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full gap-2">
      <p className="text-3xl font-bold text-gray-900">½-½</p>
      <p className="text-sm text-gray-500">{reason ?? "Game drawn"}</p>
    </div>
  );
}
