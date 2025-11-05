import React from "react";

interface Game {
  white: { username: string; result: string };
  black: { username: string; result: string };
  time_control: string;
  end_time: number;
}

interface RecentGamesProps {
  username: string;
  games: Game[] | null;
  onFetchGames: () => void;
  loadingGames: boolean;
}

export default function RecentGames({
  username,
  games,
  onFetchGames,
  loadingGames,
}: RecentGamesProps) {
  return (
    <section className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
      <h2 className="text-2xl font-semibold text-[#00bfa6] mb-4">♟️ Recent Games</h2>

      {!games && (
        <button
          onClick={onFetchGames}
          className="bg-[#00bfa6] text-white font-semibold px-6 py-2 rounded-md hover:bg-[#00d6b5] transition"
        >
          Load Recent Games
        </button>
      )}

      {loadingGames && <p className="text-gray-500 animate-pulse mt-4">Loading games...</p>}

      {games && games.length > 0 && (
        <div className="space-y-3">
          {games.map((game, i) => {
            const playerColor =
              game.white.username.toLowerCase() === username.toLowerCase()
                ? "white"
                : "black";
            const opponent =
              playerColor === "white" ? game.black.username : game.white.username;
            const result =
              playerColor === "white" ? game.white.result : game.black.result;

            const formattedResult =
              result === "win"
                ? "✅ Win"
                : result === "checkmated" || result === "resigned"
                ? "❌ Loss"
                : result === "agreed" || result === "repetition"
                ? "🤝 Draw"
                : result;

            return (
              <div
                key={i}
                className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 hover:shadow-sm transition"
              >
                <div>
                  <p className="font-semibold">{opponent}</p>
                  <p className="text-sm text-gray-500 capitalize">
                    {game.time_control} •{" "}
                    {new Date(game.end_time * 1000).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={
                    result === "win"
                      ? "text-green-600 font-bold"
                      : result === "checkmated" || result === "resigned"
                      ? "text-red-500 font-bold"
                      : "text-gray-600 font-semibold"
                  }
                >
                  {formattedResult}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
