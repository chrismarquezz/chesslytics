import { useState } from "react";
import { useUser } from "./context/UserContext";
import Navbar from "./components/Navbar";
import PlayerInput from "./components/PlayerInput";
import Ratings from "./components/Ratings";
import RecentRatingChange from "./components/RecentRatingChange";
import WinLossPieChart from "./components/WinLossPieChart";
import RatingTrendChart from "./components/RatingTrendChart";
import HighlightsSection from "./components/HighlightsSection";
import BestRatings from "./components/BestRatings";
import { getProfile, getStats, getRatingHistory } from "./api/chessAPI";

type RatingPoint = { month: string; rating: number };

export default function App() {
  const { username, setUsername } = useUser();

  const [profile, setProfile] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [trendHistory, setTrendHistory] = useState<{
    blitz: RatingPoint[];
    rapid: RatingPoint[];
    bullet: RatingPoint[];
  }>({ blitz: [], rapid: [], bullet: [] });
  const [selectedMode, setSelectedMode] = useState<"all" | "blitz" | "rapid" | "bullet">("blitz");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [games] = useState<any[]>([]);

  // === Fetch all profile + stats + rating histories ===
async function handleFetchAll() {
  if (!username.trim()) return;
  setLoading(true);
  setError(null);

  try {
    // Fetch profile, stats, and rating histories in parallel
    const [profileData, statsData, blitzHistory, rapidHistory, bulletHistory] = await Promise.all([
      getProfile(username),
      getStats(username),
      getRatingHistory(username, "blitz"),
      getRatingHistory(username, "rapid"),
      getRatingHistory(username, "bullet"),
    ]);

    // Update state
    setProfile(profileData);
    setStats(statsData);
    setTrendHistory({
      blitz: blitzHistory,
      rapid: rapidHistory,
      bullet: bulletHistory,
    });
  } catch (err) {
    console.error("Error fetching player data:", err);
    setError("Could not fetch data. Please try again.");
  } finally {
    setLoading(false);
  }
}


  const bestMode = stats
    ? Object.entries({
        Rapid: stats.chess_rapid?.last?.rating || 0,
        Blitz: stats.chess_blitz?.last?.rating || 0,
        Bullet: stats.chess_bullet?.last?.rating || 0,
      }).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col items-center px-6 py-12 pt-24">
      <Navbar />

      <header className="text-center mb-10">
        <h1 className="text-5xl font-extrabold text-[#00bfa6] mb-2">
          ♟️ Chesslytics Dashboard
        </h1>
        <p className="text-gray-500 text-lg">
          Analyze your performance and track your chess journey
        </p>
      </header>

      <PlayerInput
        username={username}
        setUsername={setUsername}
        onFetch={handleFetchAll}
        loading={loading}
      />
      {error && <p className="text-red-600 mt-3">{error}</p>}

      {profile && (
        <div className="mt-10 bg-white shadow-md rounded-xl p-6 w-full max-w-3xl flex flex-col items-center text-center">
          {profile.avatar && (
            <img
              src={profile.avatar}
              alt="avatar"
              className="w-24 h-24 rounded-full mb-4 shadow"
            />
          )}
          <h2 className="text-2xl font-semibold">{profile.username}</h2>
          {profile.name && <p className="text-gray-500">{profile.name}</p>}
          <p className="mt-2 text-gray-600">Followers: {profile.followers ?? 0}</p>
        </div>
      )}

      {stats && (
        <section className="w-full max-w-6xl mt-16 space-y-16">
          {/* === Overview Section === */}
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">
              Overview
            </h2>

            {/* --- Summary row --- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 text-center">
              <div className="bg-white shadow-sm rounded-xl p-5">
                <h4 className="text-sm text-gray-500 font-medium mb-1">Total Games</h4>
                <p className="text-2xl font-bold text-gray-800">
                  {(stats.chess_blitz?.record?.win ?? 0) +
                    (stats.chess_blitz?.record?.loss ?? 0) +
                    (stats.chess_blitz?.record?.draw ?? 0) +
                    (stats.chess_rapid?.record?.win ?? 0) +
                    (stats.chess_rapid?.record?.loss ?? 0) +
                    (stats.chess_rapid?.record?.draw ?? 0) +
                    (stats.chess_bullet?.record?.win ?? 0) +
                    (stats.chess_bullet?.record?.loss ?? 0) +
                    (stats.chess_bullet?.record?.draw ?? 0)}
                </p>
              </div>

              <div className="bg-white shadow-sm rounded-xl p-5">
                <h4 className="text-sm text-gray-500 font-medium mb-1">Overall Win Rate</h4>
                <p className="text-2xl font-bold text-[#00bfa6]">
                  {(() => {
                    const totalWins =
                      (stats.chess_blitz?.record?.win ?? 0) +
                      (stats.chess_rapid?.record?.win ?? 0) +
                      (stats.chess_bullet?.record?.win ?? 0);
                    const totalGames =
                      (stats.chess_blitz?.record?.win ?? 0) +
                      (stats.chess_blitz?.record?.loss ?? 0) +
                      (stats.chess_blitz?.record?.draw ?? 0) +
                      (stats.chess_rapid?.record?.win ?? 0) +
                      (stats.chess_rapid?.record?.loss ?? 0) +
                      (stats.chess_rapid?.record?.draw ?? 0) +
                      (stats.chess_bullet?.record?.win ?? 0) +
                      (stats.chess_bullet?.record?.loss ?? 0) +
                      (stats.chess_bullet?.record?.draw ?? 0);
                    return totalGames > 0
                      ? `${((totalWins / totalGames) * 100).toFixed(1)}%`
                      : "—";
                  })()}
                </p>
              </div>

              <div className="bg-white shadow-sm rounded-xl p-5">
                <h4 className="text-sm text-gray-500 font-medium mb-1">Best Format</h4>
                <p className="text-2xl font-bold text-gray-800">
                  {bestMode ?? "—"}
                </p>
              </div>
            </div>

            {/* --- Overview Cards --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Ratings stats={stats} />
              <BestRatings stats={stats} />
              <RecentRatingChange username={username}/>
            </div>
          </div>

          {/* === Analytics Section === */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 border-b border-gray-200 pb-2">
                Analytics
              </h2>

              {/* Mode selector */}
              <div className="flex gap-2">
                {["all", "bullet", "blitz", "rapid"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode as "all" | "bullet" | "blitz" | "rapid")}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      selectedMode === mode
                        ? "bg-[#00bfa6] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              <WinLossPieChart stats={stats} selectedMode={selectedMode} />
              <RatingTrendChart
                trendData={trendHistory[selectedMode === "all" ? "blitz" : selectedMode] || []}
                selectedMode={selectedMode}
              />
            </div>
          </div>

          {/* === Highlights Section === */}
          <HighlightsSection username={username} games={games} />
        </section>
      )}
    </div>
  );
}
