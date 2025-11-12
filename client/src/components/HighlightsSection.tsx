import { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import { getUserOutcome } from "../utils/result";

interface HighlightsSectionProps {
  username: string;
  selectedMode: "all" | "blitz" | "rapid" | "bullet";
}

export default function HighlightsSection({ username, selectedMode }: HighlightsSectionProps) {
  const { games, gamesLoading } = useUser();
  const [strongestOpponent, setStrongestOpponent] = useState<{ username: string; rating: number } | null>(null);
  const [longestWinStreak, setLongestWinStreak] = useState<number>(0);
  const [longestLossStreak, setLongestLossStreak] = useState<number>(0);

  useEffect(() => {
    if (!username || selectedMode === "all") {
      setStrongestOpponent(null);
      setLongestWinStreak(0);
      setLongestLossStreak(0);
      return;
    }

    const modeGames = games.filter((g) => g.time_class === selectedMode);
    if (!modeGames.length) {
      setStrongestOpponent(null);
      setLongestWinStreak(0);
      setLongestLossStreak(0);
      return;
    }

    // --- Strongest Opponent Beaten ---
    let bestOpponent: { username: string; rating: number } | null = null;

    for (const game of modeGames) {
      const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
      const opponent = isWhite ? game.black : game.white;

      const playerWon =
        (isWhite && game.white.result === "win") ||
        (!isWhite && game.black.result === "win");

      if (playerWon && (!bestOpponent || opponent.rating > bestOpponent.rating)) {
        bestOpponent = { username: opponent.username, rating: opponent.rating };
      }
    }
    setStrongestOpponent(bestOpponent);

    // --- Longest Win/Loss Streaks ---
    let currentWin = 0;
    let maxWin = 0;
    let currentLoss = 0;
    let maxLoss = 0;

    for (const game of modeGames) {
      const outcome = getUserOutcome(game, username);

      if (outcome === "win") {
        currentWin++;
        maxWin = Math.max(maxWin, currentWin);
        currentLoss = 0;
      } else if (outcome === "loss") {
        currentLoss++;
        maxLoss = Math.max(maxLoss, currentLoss);
        currentWin = 0;
      } else {
        currentWin = 0;
        currentLoss = 0;
      }
    }

    setLongestWinStreak(maxWin);
    setLongestLossStreak(maxLoss);
  }, [games, username, selectedMode]);

  const isLoading = gamesLoading && selectedMode !== "all";

  return (
    <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Strongest Opponent Card */}
      <div className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl p-6 border border-gray-200 text-center">
        <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
          Strongest Opponent Beaten
        </h3>
        {isLoading ? (
          <p className="text-gray-500 animate-pulse">Loading...</p>
        ) : strongestOpponent ? (
          <>
            <p className="text-3xl font-bold text-[#00bfa6]">
              {strongestOpponent.rating}
            </p>
            <p className="text-gray-600 mt-1">
              vs <span className="font-medium">{strongestOpponent.username}</span>
            </p>
          </>
        ) : (
          <p className="text-gray-500">No wins found in {selectedMode}.</p>
        )}
      </div>

      {/* Longest Streak Card */}
      <div className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl p-6 border border-gray-200 text-center">
        <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
          Longest Streaks
        </h3>
        {isLoading ? (
          <p className="text-gray-500 animate-pulse">Loading...</p>
        ) : (
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-center sm:gap-12">
            <div className="flex flex-col items-start text-left">
              <p className="text-sm uppercase tracking-wide text-gray-500">Win</p>
              <p className="text-4xl font-bold text-[#00bfa6]">{longestWinStreak || 0}</p>
            </div>
            <div className="flex flex-col items-end text-right">
              <p className="text-sm uppercase tracking-wide text-gray-500">Loss</p>
              <p className="text-4xl font-bold text-red-500">{longestLossStreak || 0}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
