import { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";

type Mode = "blitz" | "rapid" | "bullet";

interface RecentRatingChangeProps {
  username: string;
}

export default function RecentRatingChange({ username }: RecentRatingChangeProps) {
  const { games, gamesLoading } = useUser();
  const [deltas, setDeltas] = useState<{ [K in Mode]?: number }>({});

  useEffect(() => {
    if (!username) {
      setDeltas({});
      return;
    }
    if (!games.length) {
      setDeltas({});
      return;
    }

    const sorted = [...games].sort((a, b) => (a.end_time ?? 0) - (b.end_time ?? 0));

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const modeRatings: Record<Mode, { now: number; weekAgo: number }> = {
      blitz: { now: 0, weekAgo: 0 },
      rapid: { now: 0, weekAgo: 0 },
      bullet: { now: 0, weekAgo: 0 },
    };

    for (const mode of ["blitz", "rapid", "bullet"] as const) {
      const modeGames = sorted.filter((g) => g.time_class === mode);
      if (!modeGames.length) continue;

      const latest = modeGames[modeGames.length - 1];
      const weekAgoGame = modeGames.find(
        (g) => new Date((g.end_time ?? 0) * 1000) >= oneWeekAgo
      );

      const getRating = (g: any) =>
        g.white.username.toLowerCase() === username.toLowerCase()
          ? g.white.rating
          : g.black.rating;

      modeRatings[mode] = {
        now: getRating(latest),
        weekAgo: weekAgoGame ? getRating(weekAgoGame) : getRating(modeGames[0]),
      };
    }

    const deltaObj = Object.fromEntries(
      Object.entries(modeRatings).map(([k, v]) => [k, v.now - v.weekAgo])
    ) as { [K in Mode]: number };

    setDeltas(deltaObj);
  }, [games, username]);

  const modes: Mode[] = ["blitz", "rapid", "bullet"];

  return (
    <section className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Recent Rating Change
      </h3>

      {gamesLoading ? (
        <p className="text-gray-500 animate-pulse">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {modes.map((mode) => {
            const delta = deltas[mode] ?? 0;
            const { valueClasses } = getDeltaStyle(delta);
            return (
              <div
                key={mode}
                className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-2xl font-bold text-gray-700 capitalize">{mode}</p>
                <p className={`text-3xl font-bold ${valueClasses}`}>
                  {formatDelta(delta)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-sm text-gray-500 mt-3">Compared to ratings from 7 days ago</p>
    </section>
  );
}

function formatDelta(delta: number) {
  if (delta === 0) return "0 pts";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} pts`;
}

function getDeltaStyle(delta: number) {
  if (delta > 0) {
    return { valueClasses: "text-[#00bfa6]" };
  }
  if (delta < 0) {
    return { valueClasses: "text-red-500" };
  }
  return { valueClasses: "text-gray-400" };
}
