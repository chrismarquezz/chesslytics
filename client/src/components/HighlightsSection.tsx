import React, { useMemo } from "react";

interface HighlightsSectionProps {
  username: string;
  games: any[];
}

export default function HighlightsSection({ username, games }: HighlightsSectionProps) {
  // --- Strongest Opponent Beaten ---
  const strongestOpponent = useMemo(() => {
    if (!games.length) return null;

    let bestGame = null;
    let highestRating = 0;

    for (const game of games) {
      const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
      const player = isWhite ? game.white : game.black;
      const opponent = isWhite ? game.black : game.white;
      const result = isWhite ? game.white.result : game.black.result;

      if (result === "win" && opponent.rating > highestRating) {
        highestRating = opponent.rating;
        bestGame = { opponent, timeClass: game.time_class, url: game.url };
      }
    }

    return bestGame;
  }, [games, username]);

  // --- Favorite Opening by Color ---
  const favoriteOpenings = useMemo(() => {
    if (!games.length) return { white: null, black: null };

    const openingCounts = { white: {}, black: {} } as Record<string, Record<string, number>>;

    for (const game of games) {
      const color = game.white.username.toLowerCase() === username.toLowerCase() ? "white" : "black";
      const opening = game.opening?.name || "Unknown Opening";
      openingCounts[color][opening] = (openingCounts[color][opening] || 0) + 1;
    }

    const topOpening = (color: "white" | "black") => {
      const entries = Object.entries(openingCounts[color]);
      if (!entries.length) return null;
      return entries.sort((a, b) => b[1] - a[1])[0]; // [openingName, count]
    };

    return {
      white: topOpening("white"),
      black: topOpening("black"),
    };
  }, [games, username]);

  return (
    <section className="w-full max-w-6xl mt-16">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">
        Highlights
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Strongest Opponent Beaten */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
          <h3 className="text-2xl font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-3">
            Strongest Opponent Beaten
          </h3>

          {strongestOpponent ? (
            <div className="text-center">
              <p className="text-3xl font-bold text-[#00bfa6]">
                {strongestOpponent.opponent.rating}
              </p>
              <a
                href={strongestOpponent.opponent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl font-semibold text-gray-800 hover:text-[#00bfa6] transition"
              >
                {strongestOpponent.opponent.username}
              </a>
              <p className="text-gray-500 mt-2 capitalize">
                {strongestOpponent.timeClass}
              </p>
              <a
                href={strongestOpponent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-[#00bfa6] mt-2 hover:underline"
              >
                View Game →
              </a>
            </div>
          ) : (
            <p className="text-gray-500 text-center">No wins found in recent games.</p>
          )}
        </div>

        {/* Favorite Opening by Color */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
          <h3 className="text-2xl font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-3">
            Favorite Opening by Color
          </h3>

          {favoriteOpenings.white || favoriteOpenings.black ? (
            <div className="grid grid-cols-2 gap-6 text-center">
              {/* White */}
              <div>
                <h4 className="text-lg font-semibold text-gray-700 mb-1">White</h4>
                {favoriteOpenings.white ? (
                  <>
                    <p className="text-[#00bfa6] font-medium">
                      {favoriteOpenings.white[0]}
                    </p>
                    <p className="text-sm text-gray-500">
                      {favoriteOpenings.white[1]} times
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">No recent White games</p>
                )}
              </div>

              {/* Black */}
              <div>
                <h4 className="text-lg font-semibold text-gray-700 mb-1">Black</h4>
                {favoriteOpenings.black ? (
                  <>
                    <p className="text-[#00bfa6] font-medium">
                      {favoriteOpenings.black[0]}
                    </p>
                    <p className="text-sm text-gray-500">
                      {favoriteOpenings.black[1]} times
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">No recent Black games</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center">No openings found in recent games.</p>
          )}
        </div>
      </div>
    </section>
  );
}
