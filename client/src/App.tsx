import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import PlayerInput from "./components/PlayerInput";
import { useUser } from "./context/UserContext";

const DRAW_RESULTS = new Set(["stalemate", "agreed", "repetition", "timevsinsufficient", "insufficient", "50move"]);

export default function App() {
  const {
    username,
    setUsername,
    games,
    gamesLoading,
    gamesError,
    profile,
    stats,
    userDataLoading,
    userDataError,
  } = useUser();
  const navigate = useNavigate();
  const [pendingUsername, setPendingUsername] = useState(username);
  const [visibleGamesCount, setVisibleGamesCount] = useState(20);

  useEffect(() => {
    setPendingUsername(username);
  }, [username]);

  useEffect(() => {
    setVisibleGamesCount(20);
  }, [games]);

  const handleFetch = () => {
    const target = pendingUsername.trim();
    if (!target) return;
    setUsername(target);
  };

  const handleAnalyzeGame = (game: any) => {
    if (!game?.pgn) return;
    navigate("/review", { state: { pgn: game.pgn } });
  };

  const displayedGames = useMemo(() => games.slice(0, visibleGamesCount), [games, visibleGamesCount]);

  const ratingChips = [
    { label: "Bullet", value: stats?.chess_bullet?.last?.rating ?? null },
    { label: "Blitz", value: stats?.chess_blitz?.last?.rating ?? null },
    { label: "Rapid", value: stats?.chess_rapid?.last?.rating ?? null },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-16">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 pt-28 space-y-10">
        <section className="bg-white border border-gray-200 shadow rounded-2xl p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Load a Chess.com profile</h1>
          <p className="text-gray-500 mb-6">Enter a username to view ratings and quickly launch a game review.</p>
          <PlayerInput username={pendingUsername} setUsername={setPendingUsername} onFetch={handleFetch} loading={userDataLoading} />
          {userDataError && <p className="text-red-600">{userDataError}</p>}
        </section>

        {profile && (
          <section className="bg-white border border-gray-200 shadow rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-center">
            <div className="flex flex-col items-center text-center">
              {profile.avatar ? (
                <img src={profile.avatar} alt={`${profile.username} avatar`} className="w-28 h-28 rounded-full shadow" />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-semibold text-gray-500">
                  {profile.username?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">{profile.username}</h2>
              {profile.name && <p className="text-gray-500">{profile.name}</p>}
              <div className="flex flex-wrap gap-3 mt-4">
                {ratingChips.map((chip) => (
                  <div key={chip.label} className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-2 text-center min-w-[100px]">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{chip.label}</p>
                    <p className="text-lg font-semibold text-gray-900">{chip.value ?? "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="bg-white border border-gray-200 shadow rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">Recent Games</h3>
              <p className="text-sm text-gray-500">Showing the latest {Math.min(visibleGamesCount, games.length)} games</p>
            </div>
            {gamesError && <p className="text-sm text-red-500">{gamesError}</p>}
          </div>

          {gamesLoading ? (
            <p className="text-center text-gray-500 py-10">Loading games…</p>
          ) : displayedGames.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No games found. Load a profile to begin.</p>
          ) : (
            <>
              <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {displayedGames.map((game) => {
                  const { opponentName, userResult, badgeClass, resultLabel, timeLabel, dateLabel } = summarizeGame(game, username);
                  return (
                    <div key={game.url} className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                          {game.white?.username} vs {game.black?.username}
                        </p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>{resultLabel}</span>
                      </div>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>
                          Opponent: <span className="text-gray-800 font-medium">{opponentName}</span>
                        </p>
                        <p>
                          Time Control: <span className="text-gray-800 font-medium">{timeLabel}</span>
                        </p>
                        <p>
                          Result: <span className="text-gray-800 font-medium">{userResult}</span>
                        </p>
                        {dateLabel && (
                          <p>
                            Played: <span className="text-gray-800 font-medium">{dateLabel}</span>
                          </p>
                        )}
                      </div>
                      <button
                        className="mt-auto inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 font-semibold px-4 py-2 hover:bg-gray-50 transition"
                        onClick={() => handleAnalyzeGame(game)}
                      >
                        Analyze
                      </button>
                    </div>
                  );
                })}
              </div>
              {visibleGamesCount < games.length && (
                <div className="text-center mt-6">
                  <button
                    onClick={() => setVisibleGamesCount((prev) => Math.min(prev + 20, games.length))}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function summarizeGame(game: any, username: string) {
  const lower = username.toLowerCase();
  const isWhite = game.white?.username?.toLowerCase() === lower;
  const userSide = isWhite ? game.white : game.black;
  const opponent = isWhite ? game.black : game.white;
  const result = (userSide?.result ?? "").toLowerCase();
  let userResult = "Loss";
  let badgeClass = "bg-rose-100 text-rose-700";
  let resultLabel = "Loss";

  if (result === "win") {
    userResult = "Win";
    resultLabel = "Win";
    badgeClass = "bg-emerald-100 text-emerald-700";
  } else if (DRAW_RESULTS.has(result)) {
    userResult = "Draw";
    resultLabel = "Draw";
    badgeClass = "bg-gray-200 text-gray-800";
  }

  const timeLabel = formatTimeControl(game.time_class, game.time_control);
  const dateLabel = game.end_time ? new Date(game.end_time * 1000).toLocaleDateString() : "";

  return {
    opponentName: opponent?.username ?? "Unknown",
    userResult,
    badgeClass,
    resultLabel,
    timeLabel,
    dateLabel,
  };
}

function formatTimeControl(timeClass?: string, control?: string) {
  if (!control) return timeClass ? capitalize(timeClass) : "Unknown";
  const [baseStr, incStr] = control.split("+");
  const baseSeconds = Number(baseStr) || 0;
  const baseMinutes = baseSeconds >= 60 ? Math.floor(baseSeconds / 60) : 0;
  const baseLabel = baseMinutes ? `${baseMinutes}m` : `${baseSeconds}s`;
  const increment = incStr ? Number(incStr) : 0;
  const incLabel = increment ? ` + ${increment}s` : "";
  return `${timeClass ? capitalize(timeClass) : "Live"} (${baseLabel}${incLabel})`;
}

function capitalize(value?: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
