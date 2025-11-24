import { useMemo } from "react";
import { getUserOutcome } from "../utils/result";

interface UpsetPotentialProps {
  username: string;
  selectedMode: "all" | "blitz" | "rapid" | "bullet";
  games: any[];
  gamesLoading?: boolean;
}

type BucketKey = "stronger" | "weaker";

export default function UpsetPotential({
  username,
  selectedMode,
  games,
  gamesLoading = false,
}: UpsetPotentialProps) {
  const normalizedUsername = username?.toLowerCase?.() ?? "";
  const disabled = !normalizedUsername || selectedMode === "all";

  const bucketStats = useMemo(() => {
    const base: Record<BucketKey, { total: number; wins: number; diffSum: number }> = {
      stronger: { total: 0, wins: 0, diffSum: 0 },
      weaker: { total: 0, wins: 0, diffSum: 0 },
    };

    if (disabled) return base;

    for (const game of games) {
      if (game.time_class !== selectedMode) continue;
      if (!game.rated) continue;

      const isWhite = game.white?.username?.toLowerCase() === normalizedUsername;
      const me = isWhite ? game.white : game.black;
      const opp = isWhite ? game.black : game.white;

      if (typeof me?.rating !== "number" || typeof opp?.rating !== "number") continue;

      const diff = opp.rating - me.rating;
      const bucket: BucketKey = diff >= 0 ? "stronger" : "weaker";

      base[bucket].total += 1;
      base[bucket].diffSum += diff;
      if (getUserOutcome(game, username) === "win") {
        base[bucket].wins += 1;
      }
    }

    return base;
  }, [games, normalizedUsername, selectedMode, disabled, username]);

  const segments: Array<{
    key: BucketKey;
    label: string;
    highlight: string;
  }> = [
    { key: "stronger", label: "vs. higher-rated players", highlight: "text-[#00bfa6]" },
    { key: "weaker", label: "vs. lower-rated players", highlight: "text-indigo-600" },
  ];

  const isLoading = gamesLoading && !disabled;

  return (
    <div className="bg-white shadow-lg transition-all duration-300 rounded-2xl p-6 border border-gray-200 text-center">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Upset Potential
      </h3>

      {disabled ? (
        <p className="text-gray-500">Choose a specific mode to see matchup splits.</p>
      ) : isLoading ? (
        <p className="text-gray-500 animate-pulse">Crunching the numbers...</p>
      ) : (
        <div className="space-y-4">
          {segments.map(({ key, label, highlight }) => {
            const bucket = bucketStats[key];
            if (!bucket.total) {
              return (
                <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 text-gray-500">
                  Not enough rated games {label}.
                </div>
              );
            }

            const winRate = (bucket.wins / bucket.total) * 100;
            const avgDiff = bucket.diffSum / bucket.total;
            const diffLabel =
              avgDiff === 0
                ? "even opponents"
                : avgDiff > 0
                ? `avg +${Math.round(avgDiff)} ELO`
                : `avg ${Math.round(avgDiff)} ELO`;

            return (
              <div
                key={key}
                className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 flex flex-col gap-1"
              >
                <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                <p className={`text-3xl font-bold ${highlight}`}>{winRate.toFixed(0)}%</p>
                <p className="text-gray-600 text-sm">{diffLabel}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {bucket.wins} wins / {bucket.total} games
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
