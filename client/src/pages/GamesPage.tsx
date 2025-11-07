import { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import Navbar from "../components/Navbar";
import { getRecentGames } from "../api/chessAPI";
import GameStatsSummary from "../components/GameStatsSummary";
import GamesFilterBar from "../components/GamesFilterBar";
import RecentGamesTable from "../components/RecentGamesTable";
import { getUserOutcome } from "../utils/result";
import PerformanceByColorChart from "../components/PerformanceByColorChart";
import PerformanceByTimeChart from "../components/PerformanceByTimeChart";

export default function GamesPage() {
  const { username } = useUser();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState("all");
  const [selectedResult, setSelectedResult] = useState("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // --- Fetch games ---
  const fetchGames = async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getRecentGames(username);
      const sorted = [...data].sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0));
      setGames(sorted);
      setLastUpdated(new Date());
    } catch {
      setError("Could not load recent games.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, [username]);

  // --- Apply filters for display ---
  const filteredGames = games.filter((g) => {
    const modeOK = selectedMode === "all" || g.time_class === selectedMode;
    const outcome = getUserOutcome(g, username);
    const resultOK = selectedResult === "all" || selectedResult === outcome;
    return modeOK && resultOK;
  });

  // --- Win rate ---
  const modeFiltered = games.filter(
    (g) => selectedMode === "all" || g.time_class === selectedMode
  );
  const totalGames = modeFiltered.length;
  const wins = modeFiltered.filter((g) => getUserOutcome(g, username) === "win").length;
  const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : "—";

  // --- Average opponent rating ---
  const avgOpponent =
    totalGames > 0
      ? Math.round(
          modeFiltered.reduce((sum, g) => {
            const isWhite = g.white.username.toLowerCase() === username?.toLowerCase();
            return sum + (isWhite ? g.black.rating : g.white.rating);
          }, 0) / totalGames
        )
      : "—";

  // --- Current streak (wins from most recent backward) ---
  const sortedByTime = [...modeFiltered].sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0));
  let currentStreak = 0;
  for (const g of sortedByTime) {
    const outcome = getUserOutcome(g, username);
    if (outcome === "win") currentStreak++;
    else break;
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 text-gray-800 px-6 py-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
            <h1 className="text-4xl font-bold text-gray-800">Games</h1>
          </div>

          {/* Filters + Timestamp */}
          <div className="relative">
            <GamesFilterBar
              selectedMode={selectedMode}
              setSelectedMode={setSelectedMode}
              selectedResult={selectedResult}
              setSelectedResult={setSelectedResult}
              onRefresh={fetchGames}
            />
          </div>

          {/* Stats Summary */}
          <GameStatsSummary
            totalGames={totalGames}
            winRate={winRate}
            avgOpponent={avgOpponent}
            currentStreak={currentStreak}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
  <PerformanceByColorChart games={filteredGames} username={username} />
  <PerformanceByTimeChart games={filteredGames} username={username} />
</div>

          {/* Table */}
          {loading ? (
            <p className="text-gray-500 animate-pulse mt-6">Loading games...</p>
          ) : error ? (
            <p className="text-red-500 mt-6">{error}</p>
          ) : (
            <RecentGamesTable games={filteredGames} username={username} />
          )}
        </div>
      </div>
    </>
  );
}
