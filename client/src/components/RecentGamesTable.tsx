import { useMemo } from "react";
import { getUserOutcome } from "../utils/result";
import { computeRatingDeltas } from "../utils/ratingDelta";

interface RecentGamesTableProps {
  games: any[];
  allGames: any[];
  username: string; // add this so we can compute perspective correctly
}

export default function RecentGamesTable({ games, allGames, username }: RecentGamesTableProps) {
  if (!games?.length) return null;

  const ratingDeltas = useMemo(() => computeRatingDeltas(allGames, username), [allGames, username]);

  return (
    <section className="bg-white shadow-lg transition-all duration-300 rounded-2xl p-6 border border-gray-200 w-full overflow-x-auto">
      <h3 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Recent Games
      </h3>

      <table className="min-w-full text-sm text-gray-700">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2">Opponent</th>
            <th className="pb-2">Result</th>
            <th className="pb-2">Type</th>
            <th className="pb-2">Date</th>
            <th className="pb-2 text-right">Rating Δ</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game, index) => {
            const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
            const opp = isWhite ? game.black : game.white;

            const outcome = getUserOutcome(game, username); // "win" | "loss" | "draw"
            const resultText = outcome === "win" ? "Win" : outcome === "loss" ? "Loss" : "Draw";

            const color =
              outcome === "win" ? "text-[#00bfa6]" : outcome === "loss" ? "text-red-500" : "text-gray-500";

            const date = new Date(game.end_time * 1000).toLocaleDateString();

            const deltaRaw = ratingDeltas.get(game);
            const delta =
              typeof deltaRaw === "number" ? Math.round(deltaRaw) : null;

            return (
              <tr key={index} className="border-b last:border-none hover:bg-gray-50 transition-colors">
                <td className="py-2">
                  <a
                    href={opp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#00bfa6] transition-colors"
                  >
                    {opp.username}
                  </a>
                </td>
                <td className={`py-2 font-medium ${color}`}>{resultText}</td>
                <td className="py-2 capitalize">{game.time_class}</td>
                <td className="py-2">{date}</td>
                <td className={`py-2 text-right font-mono ${color}`}>
                  {delta === null ? "—" : delta > 0 ? `+${delta}` : `${delta}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
