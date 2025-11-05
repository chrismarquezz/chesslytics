import { useState } from "react";
import PlayerInput from "./components/PlayerInput";
import Ratings from "./components/Ratings";
import PerformanceInsights from "./components/PerformanceInsights";
import RecentRatingChange from "./components/RecentRatingChange";
import WinLossPieChart from "./components/WinLossPieChart";
import RatingTrendChart from "./components/RatingTrendChart";
import { getProfile, getStats, getRatingHistory } from "./api/chessAPI";

// Define the structure for rating history entries
type RatingPoint = { month: string; rating: number };

export default function App() {
  // ---------- State ----------
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [trendHistory, setTrendHistory] = useState<{
    blitz: RatingPoint[];
    rapid: RatingPoint[];
    bullet: RatingPoint[];
  }>({
    blitz: [],
    rapid: [],
    bullet: [],
  });

  const [selectedTrendMode, setSelectedTrendMode] = useState<"blitz" | "rapid" | "bullet">("blitz");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"blitz" | "rapid" | "bullet">("blitz");

  // ---------- API Handlers ----------
  async function handleFetchAll() {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const [profileData, statsData, blitzHistory] = await Promise.all([
        getProfile(username),
        getStats(username),
        getRatingHistory(username, "blitz"),
      ]);

      setProfile(profileData);
      setStats(statsData);
      setTrendHistory({
        blitz: blitzHistory,
        rapid: [],
        bullet: [],
      });
    } catch (err) {
      console.error(err);
      setError("Could not fetch data.");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Derived values ----------
  const avgRating =
    stats &&
    Math.round(
      (stats.chess_rapid?.last?.rating +
        stats.chess_blitz?.last?.rating +
        stats.chess_bullet?.last?.rating) /
        3
    );

  const bestMode = stats
    ? Object.entries({
        Rapid: stats.chess_rapid?.last?.rating || 0,
        Blitz: stats.chess_blitz?.last?.rating || 0,
        Bullet: stats.chess_bullet?.last?.rating || 0,
      }).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // ---------- Render ----------
  return (
  <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col items-center px-6 py-12">
    {/* ===== Header ===== */}
    <header className="text-center mb-10">
      <h1 className="text-5xl font-extrabold text-[#00bfa6] mb-2">♟️ Chesslytics</h1>
      <p className="text-gray-500 text-lg">
        Analyze your chess performance, trends, and insights
      </p>
    </header>

    {/* ===== Player Input ===== */}
    <PlayerInput
      username={username}
      setUsername={setUsername}
      onFetch={handleFetchAll}
      loading={loading}
    />
    {error && <p className="text-red-600 mt-3">{error}</p>}

    {/* ===== Profile Summary ===== */}
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
        <p className="mt-2 text-gray-600">Friends: {profile.followers ?? 0}</p>
      </div>
    )}

    {/* ===== Main Analytics Section ===== */}
    {stats && (
  <section className="w-full max-w-6xl mt-16 space-y-16">
    {/* === Overview Section === */}
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">
        📊 Overview
      </h2>

      {/* ---- Summary Row ---- */}
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

      {/* ---- Overview Cards ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Ratings stats={stats} /> {/* → internally rename title: "Ratings Snapshot" */}
        <PerformanceInsights
          avgRating={avgRating}
          bestMode={bestMode}
        /> {/* → internally rename title: "Performance Highlights" */}
  <RecentRatingChange username={username} /> {/* ⬅️ New version */}
      </div>
    </div>

    {/* === Analytics Section === */}
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">
        📈 Analytics
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        <WinLossPieChart
          stats={stats}
          selectedMode={selectedMode}
          setSelectedMode={setSelectedMode}
        /> {/* → internally rename title: "Win / Loss Distribution" */}
        <RatingTrendChart
          trendData={trendHistory[selectedTrendMode]}
          selectedTrendMode={selectedTrendMode}
          setSelectedTrendMode={setSelectedTrendMode}
        /> {/* → internally rename title: "Rating Progress Over Time" */}
      </div>
    </div>
  </section>
)}

  </div>
);
}
