import { useEffect, useState } from "react";
import axios from "axios";

type RecentRatingChangeProps = {
  username: string;
};

type Mode = "blitz" | "rapid" | "bullet";

export default function RecentRatingChange({ username }: RecentRatingChangeProps) {
  const [deltas, setDeltas] = useState<{ [K in Mode]?: number }>({});
  const [loading, setLoading] = useState(false);

  const fetchRecentRatings = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const thisMonth = now.toISOString().slice(0, 7).split("-");
      const prevMonthDate = new Date(now);
      prevMonthDate.setMonth(now.getMonth() - 1);
      const prevMonth = prevMonthDate.toISOString().slice(0, 7).split("-");

      const urls = [
        `https://api.chess.com/pub/player/${username}/games/${thisMonth[0]}/${thisMonth[1]}`,
        `https://api.chess.com/pub/player/${username}/games/${prevMonth[0]}/${prevMonth[1]}`,
      ];

      const [thisMonthData, prevMonthData] = await Promise.all(
        urls.map((url) =>
          axios.get(url).then((res) => res.data).catch(() => ({ games: [] }))
        )
      );

      const allGames = [...(prevMonthData.games || []), ...(thisMonthData.games || [])];
      if (!allGames.length) return;

      const sorted = allGames.sort(
        (a: any, b: any) =>
          new Date(a.end_time * 1000).getTime() - new Date(b.end_time * 1000).getTime()
      );

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const modeRatings: { [K in Mode]?: { now: number; weekAgo: number } } = {
        blitz: { now: 0, weekAgo: 0 },
        rapid: { now: 0, weekAgo: 0 },
        bullet: { now: 0, weekAgo: 0 },
      };

      for (const mode of ["blitz", "rapid", "bullet"] as const) {
        const modeGames = sorted.filter((g: any) => g.time_class === mode);
        if (!modeGames.length) continue;

        const latest = modeGames[modeGames.length - 1];
        const weekAgoGame = modeGames.find(
          (g: any) => new Date(g.end_time * 1000) >= oneWeekAgo
        );

        modeRatings[mode] = {
          now:
            latest?.white?.username?.toLowerCase() === username.toLowerCase()
              ? latest.white.rating
              : latest.black.rating,
          weekAgo: weekAgoGame
            ? weekAgoGame.white.username.toLowerCase() === username.toLowerCase()
              ? weekAgoGame.white.rating
              : weekAgoGame.black.rating
            : modeGames[0].white.username.toLowerCase() === username.toLowerCase()
              ? modeGames[0].white.rating
              : modeGames[0].black.rating,
        };
      }

      const deltaObj = Object.fromEntries(
        Object.entries(modeRatings).map(([k, v]: any) => [
          k,
          (v.now || 0) - (v.weekAgo || 0),
        ])
      ) as { [K in Mode]: number };

      setDeltas(deltaObj);
    } catch (err) {
      console.error("Failed to fetch recent rating change:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username) fetchRecentRatings();
  }, [username]);

  const modes: Mode[] = ["blitz", "rapid", "bullet"];

  return (
    <section className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Recent Rating Change
      </h3>

      {loading ? (
        <p className="text-gray-500 animate-pulse">Loading...</p>
      ) : (
        <div className="space-y-3">
          {modes.map((mode) => {
            const delta = deltas[mode] ?? 0;
            const isPositive = delta >= 0;
            return (
              <div
                key={mode}
                className="flex justify-between items-center border-b border-gray-100 pb-2"
              >
                <span className="capitalize font-medium text-gray-700">
                  {mode}
                </span>
                <span
                  className={`font-semibold ${
                    isPositive ? "text-[#00bfa6]" : "text-red-500"
                  }`}
                >
                  {isPositive ? "▲" : "▼"} {Math.abs(delta)} pts
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-sm text-gray-500 mt-3">
        Compared to ratings from 7 days ago
      </p>
    </section>
  );
}
