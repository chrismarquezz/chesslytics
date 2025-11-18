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
  const [manualPgn, setManualPgn] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

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
    const whiteName = game.white?.username ?? "White";
    const blackName = game.black?.username ?? "Black";
    navigate("/review", { state: { pgn: game.pgn, players: { white: whiteName, black: blackName } } });
  };

  const handleManualAnalyze = () => {
    const trimmed = manualPgn.trim();
    if (!trimmed) {
      setManualError("PGN cannot be empty.");
      return;
    }
    setManualError(null);
    navigate("/review", { state: { pgn: trimmed } });
    setIsManualModalOpen(false);
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
              {profile.username?.charAt(0)?.toUpperCase() ?? "W"}
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">Recent Games</h3>
              <p className="text-sm text-gray-500">Showing the latest {Math.min(visibleGamesCount, games.length)} games</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
              {gamesError && <p className="text-sm text-red-500">{gamesError}</p>}
              <button
                onClick={() => setIsManualModalOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Analyze PGN
              </button>
            </div>
          </div>

          {gamesLoading ? (
            <p className="text-center text-gray-500 py-10">Loading games…</p>
          ) : displayedGames.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No games found. Load a profile to begin.</p>
          ) : (
            <>
              <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {displayedGames.map((game) => {
                  const {
                    opponentName,
                    badgeClass,
                    resultLabel,
                    timeLabel,
                    timeShortLabel,
                    relativeTimeLabel,
                    moveCount,
                  } = summarizeGame(game, username);
                  const whiteName = game.white?.username?.trim() || "White";
                  const blackName = game.black?.username?.trim() || "Black";
                  return (
                    <div key={game.url} className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">{timeShortLabel}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>{resultLabel}</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full border border-gray-300 bg-white" />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{whiteName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full bg-gray-900" />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{blackName}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <span>{relativeTimeLabel}</span>
                          {moveCount ? <span>• {moveCount} moves</span> : null}
                        </div>
                        <button
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 font-semibold px-4 py-2 hover:bg-gray-50 transition"
                          onClick={() => handleAnalyzeGame(game, timeLabel)}
                        >
                          Analyze
                        </button>
                      </div>
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

        {isManualModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Load Analysis From PGN</h3>
                  <p className="text-sm text-gray-500">Paste any PGN to analyze it immediately.</p>
                </div>
                <button
                  className="text-gray-400 hover:text-gray-600 text-xl font-semibold"
                  onClick={() => setIsManualModalOpen(false)}
                >
                  ×
                </button>
              </div>
              <textarea
                value={manualPgn}
                onChange={(e) => {
                  setManualPgn(e.target.value);
                  if (manualError) setManualError(null);
                }}
                rows={8}
                placeholder="Paste PGN here..."
                className="w-full rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#00bfa6] focus:border-[#00bfa6] px-4 py-3 text-gray-800 resize-y"
              />
              {manualError && <p className="text-sm text-red-600">{manualError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualAnalyze}
                  className="inline-flex items-center justify-center rounded-xl bg-[#00bfa6] text-white font-semibold px-6 py-2.5 shadow hover:bg-[#00a58f] transition disabled:opacity-40"
                  disabled={!manualPgn.trim()}
                >
                  Analyze PGN
                </button>
              </div>
            </div>
          </div>
        )}
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
  const timeShortLabel = formatShortTimeControl(game.time_control);
  const relativeTimeLabel = formatTimeAgo(game.end_time);
  const moveCount = getMoveCountFromPgn(game.pgn);

  return {
    opponentName: opponent?.username ?? "Unknown",
    badgeClass,
    resultLabel,
    timeLabel,
    timeShortLabel,
    relativeTimeLabel,
    moveCount,
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

function formatShortTimeControl(control?: string) {
  if (!control) return "—";
  const [baseStr, incStr] = control.split("+");
  const baseSeconds = Number(baseStr) || 0;
  const increment = incStr ? Number(incStr) : 0;
  const baseValue = baseSeconds >= 60 && baseSeconds % 60 === 0 ? baseSeconds / 60 : baseSeconds;
  return `${baseValue} + ${increment}`;
}

function capitalize(value?: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTimeAgo(epochSeconds?: number) {
  if (!epochSeconds) return "Unknown time";
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor(now / 1000 - epochSeconds));
  const intervals: Array<{ label: string; seconds: number }> = [
    { label: "y", seconds: 31536000 },
    { label: "mo", seconds: 2592000 },
    { label: "w", seconds: 604800 },
    { label: "d", seconds: 86400 },
    { label: "h", seconds: 3600 },
    { label: "m", seconds: 60 },
  ];
  for (const interval of intervals) {
    if (diffSeconds >= interval.seconds) {
      const value = Math.floor(diffSeconds / interval.seconds);
      return `${value}${interval.label} ago`;
    }
  }
  return `${diffSeconds}s ago`;
}

function getMoveCountFromPgn(pgn?: string) {
  if (!pgn) return null;
  const matches = pgn.match(/\b\d+\./g);
  return matches ? matches.length : null;
}
