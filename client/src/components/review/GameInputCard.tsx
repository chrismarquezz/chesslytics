interface GameInputCardProps {
  pgnInput: string;
  onChange: (value: string) => void;
  onLoadSample: () => void;
  onAnalyze: () => void;
  canAnalyze: boolean;
  loading: boolean;
  inputError?: string | null;
  analysisError?: string | null;
}

export default function GameInputCard({
  pgnInput,
  onChange,
  onLoadSample,
  onAnalyze,
  canAnalyze,
  loading,
  inputError,
  analysisError,
}: GameInputCardProps) {
  return (
    <div className="bg-white shadow-lg transition-all duration-300 rounded-2xl border border-gray-200 p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-800">Game Input</h2>
        <p className="text-sm text-gray-500 mt-1">
          Paste a PGN or try the sample to preview the review workflow.
        </p>
      </div>
      <textarea
        value={pgnInput}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`[Event "Live Chess"]\n1. e4 e5 2. Nf3 Nc6 ...`}
        className="w-full h-56 border border-gray-200 rounded-xl p-4 font-mono text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00bfa6] focus:border-transparent resize-none"
      />
      {(inputError || analysisError) && (
        <p className="text-sm text-red-500">{inputError || analysisError}</p>
      )}
      <div className="flex flex-wrap gap-3 justify-end">
        <button
          onClick={onLoadSample}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
        >
          Load Sample
        </button>
        <button
          onClick={onAnalyze}
          className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${
            canAnalyze ? "bg-[#00bfa6] hover:bg-[#00d6b5]" : "bg-gray-300 cursor-not-allowed"
          } shadow-md transition`}
          disabled={!canAnalyze || loading}
        >
          {loading ? "Analyzing..." : "Analyze Game"}
        </button>
      </div>
    </div>
  );
}
