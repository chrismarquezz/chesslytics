interface GameReviewHeaderProps {
  analysisReady: boolean;
  onLoadNewPGN: () => void;
}

export default function GameReviewHeader({ analysisReady, onLoadNewPGN }: GameReviewHeaderProps) {
  return (
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
            onClick={onLoadNewPGN}
            className="self-start sm:self-auto px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition"
          >
            Load New PGN
          </button>
        )}
      </div>
    </header>
  );
}
