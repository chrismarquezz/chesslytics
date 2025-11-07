interface GamesFilterBarProps {
  selectedMode: string;
  setSelectedMode: (mode: string) => void;
  selectedResult: string;
  setSelectedResult: (result: string) => void;
  onRefresh: () => void;
}

export default function GamesFilterBar({
  selectedMode,
  setSelectedMode,
  selectedResult,
  setSelectedResult,
  onRefresh,
}: GamesFilterBarProps) {
  const modes = ["all", "blitz", "rapid", "bullet"];
  const results = ["all", "win", "loss", "draw"];

  return (
    <div className="bg-white shadow-md rounded-xl p-4 flex flex-wrap justify-between items-center gap-4 border border-gray-200 mb-6">
      {/* Left side – filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium border transition ${
                selectedMode === mode
                  ? "bg-[#00bfa6] text-white border-[#00bfa6]"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Right side – refresh */}
      <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
        <button
          onClick={onRefresh}
          className="bg-[#00bfa6] hover:bg-[#00d6b5] text-white font-medium px-4 py-2 rounded-md transition"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
