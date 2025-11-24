import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useUser } from "./context/UserContext";
import { getProfile } from "./api/chessAPI";
import { Chess } from "chess.js";

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
    refreshGames,
    fetchUserData,
  } = useUser();
  const navigate = useNavigate();
  const [pendingUsername, setPendingUsername] = useState(username);
  const [visibleGamesCount, setVisibleGamesCount] = useState(20);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(!username);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isUsernameSubmitting, setIsUsernameSubmitting] = useState(false);
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [gameSearch, setGameSearch] = useState("");

  useEffect(() => {
    setPendingUsername(username);
  }, [username]);

  useEffect(() => {
    setVisibleGamesCount(20);
  }, [games]);

  useEffect(() => {
    if (!username.trim()) {
      setIsUsernameModalOpen(true);
    }
  }, [username]);

  useEffect(() => {
    if (!pendingUsername.trim()) {
      setUsernameCheckStatus("idle");
      setUsernameError(null);
      return;
    }

    setUsernameCheckStatus("loading");
    const handle = setTimeout(async () => {
      try {
        await getProfile(pendingUsername.trim());
        setUsernameCheckStatus("valid");
        setUsernameError(null);
      } catch {
        setUsernameCheckStatus("invalid");
        setUsernameError("Account not found. Please check the username.");
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [pendingUsername]);

  const handleUsernameSubmit = async () => {
    const target = pendingUsername.trim();
    if (!target) {
      setUsernameError("Username cannot be empty.");
      return;
    }
    if (usernameCheckStatus !== "valid") {
      setUsernameError("Please enter a valid Chess.com username.");
      return;
    }
    setUsernameError(null);
    setIsUsernameSubmitting(true);
    const ok = await fetchUserData(target);
    setIsUsernameSubmitting(false);
    if (!ok) {
      setUsernameError("Account not found. Please enter a valid Chess.com username.");
      return;
    }
    setUsername(target);
    setIsUsernameModalOpen(false);
  };

  const handleAnalyzeGame = (game: any) => {
    if (!game?.pgn) return;
    const whiteName = game.white?.username ?? "White";
    const blackName = game.black?.username ?? "Black";
    navigate("/review", { state: { pgn: game.pgn, players: { white: whiteName, black: blackName } } });
  };

  const handleRefresh = () => {
    refreshGames();
    if (username.trim()) {
      void fetchUserData(username);
    }
  };

  const filteredGames = useMemo(() => {
    const q = gameSearch.trim().toLowerCase();
    if (!q) return games;
    return games.filter((game) => {
      const lower = username.toLowerCase();
      const isWhite = game.white?.username?.toLowerCase() === lower;
      const opponentName = (isWhite ? game.black?.username : game.white?.username) ?? "";
      const openingRaw = getOpeningFromPgn(game.pgn) || game.opening || game.eco || "";
      const openingLabel = formatOpeningLabel(openingRaw).toLowerCase();
      return opponentName.toLowerCase().includes(q) || openingLabel.includes(q);
    });
  }, [games, gameSearch, username]);

  const displayedGames = useMemo(
    () => filteredGames.slice(0, visibleGamesCount),
    [filteredGames, visibleGamesCount]
  );

  const ratingChips = [
    { label: "Bullet", value: stats?.chess_bullet?.last?.rating ?? null },
    { label: "Blitz", value: stats?.chess_blitz?.last?.rating ?? null },
    { label: "Rapid", value: stats?.chess_rapid?.last?.rating ?? null },
  ];
  const canDismissUsernameModal = Boolean(username);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-16">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 pt-28 space-y-10">
        <section className="bg-white border border-gray-200 shadow rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Chess.com profile</h1>
              <p className="text-gray-500">Set your username to load ratings, stats, and recent games.</p>
              {username ? (
                <p className="text-sm text-gray-700 mt-2">
                  Current username: <span className="font-semibold text-gray-900">{username}</span>
                </p>
              ) : (
                <p className="text-sm text-rose-600 mt-2">No username set yet.</p>
              )}
            </div>
            <button
              onClick={() => setIsUsernameModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition"
            >
              {username ? "Change username" : "Set username"}
            </button>
          </div>
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
              <p className="text-sm text-gray-500">
                Showing {displayedGames.length} of {filteredGames.length} games
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
              {gamesError && <p className="text-sm text-red-500">{gamesError}</p>}
              <input
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
                placeholder="Search opponent or opening..."
                className="w-64 rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-[#00bfa6] focus:border-[#00bfa6]"
              />
              <button
                onClick={handleRefresh}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                disabled={gamesLoading || userDataLoading}
              >
                {gamesLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {gamesLoading ? (
            <p className="text-center text-gray-500 py-10">Loading games…</p>
          ) : displayedGames.length === 0 ? (
            <p className="text-center text-gray-500 py-10">
              {gameSearch.trim()
                ? `No games match “${gameSearch.trim()}”.`
                : "No games found. Load a profile to begin."}
            </p>
          ) : (
            <>
              <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {displayedGames.map((game) => {
                  const {
                    badgeClass,
                    resultLabel,
                    timeShortLabel,
                    relativeTimeLabel,
                    moveCount,
                  } = summarizeGame(game, username);
                  const whiteName = game.white?.username?.trim() || "White";
                  const blackName = game.black?.username?.trim() || "Black";
                  const openingTag = getOpeningFromPgn(game.pgn);
                  const openingLabel = formatOpeningLabel(openingTag || game.opening || game.eco);
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
                        <p className="text-xs text-gray-800 font-semibold">{openingLabel}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <span>{relativeTimeLabel}</span>
                          {moveCount ? <span>• {moveCount} moves</span> : null}
                        </div>
                        <button
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 font-semibold px-4 py-2 hover:bg-gray-50 transition"
                          onClick={() => handleAnalyzeGame(game)}
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

        {isUsernameModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Enter your Chess.com username</h3>
                  <p className="text-sm text-gray-500">We’ll use this to load your profile, stats, and games.</p>
                </div>
                {canDismissUsernameModal && (
                  <button
                    className="text-gray-400 hover:text-gray-600 text-xl font-semibold"
                    onClick={() => {
                      setIsUsernameModalOpen(false);
                      setUsernameError(null);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={pendingUsername}
                  onChange={(e) => {
                    setPendingUsername(e.target.value);
                    if (usernameError) setUsernameError(null);
                  }}
                  placeholder="Chess.com username"
                  className="w-full rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#00bfa6] focus:border-[#00bfa6] px-4 py-3 text-gray-800"
                />
                <div className="min-h-[20px]">
                  {usernameError ? (
                    <p className="text-sm text-red-600">{usernameError}</p>
                  ) : usernameCheckStatus === "valid" ? (
                    <p className="text-sm text-emerald-600">Account found.</p>
                  ) : usernameCheckStatus === "loading" ? (
                    <p className="text-sm text-gray-500">Checking…</p>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                {canDismissUsernameModal && (
                  <button
                    onClick={() => {
                      setIsUsernameModalOpen(false);
                      setUsernameError(null);
                    }}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleUsernameSubmit}
                  className="inline-flex items-center justify-center rounded-xl bg-[#00bfa6] text-white font-semibold px-6 py-2.5 shadow hover:bg-[#00a58f] transition disabled:opacity-40"
                  disabled={!pendingUsername.trim() || isUsernameSubmitting || usernameCheckStatus !== "valid"}
                >
                  {isUsernameSubmitting ? "Loading..." : "Continue"}
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
  const result = (userSide?.result ?? "").toLowerCase();
  let badgeClass = "bg-rose-100 text-rose-700";
  let resultLabel = "Loss";

  if (result === "win") {
    resultLabel = "Win";
    badgeClass = "bg-emerald-100 text-emerald-700";
  } else if (DRAW_RESULTS.has(result)) {
    resultLabel = "Draw";
    badgeClass = "bg-gray-200 text-gray-800";
  }

  return {
    badgeClass,
    resultLabel,
    timeShortLabel: formatShortTimeControl(game.time_control),
    relativeTimeLabel: formatTimeAgo(game.end_time),
    moveCount: getMoveCountFromPgn(game.pgn),
  };
}

function formatShortTimeControl(control?: string) {
  if (!control) return "—";
  const [baseStr, incStr] = control.split("+");
  const baseSeconds = Number(baseStr) || 0;
  const increment = incStr ? Number(incStr) : 0;
  const baseValue = baseSeconds >= 60 && baseSeconds % 60 === 0 ? baseSeconds / 60 : baseSeconds;
  return `${baseValue} + ${increment}`;
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
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const plyCount = chess.history().length;
    const moveCount = Math.ceil(plyCount / 2);
    return moveCount || null;
  } catch {
    return null;
  }
}

function getOpeningFromPgn(pgn?: string): string | null {
  if (!pgn) return null;
  try {
    const openingMatch = pgn.match(/\[Opening\s+"([^"]+)"\]/i);
    if (openingMatch?.[1]) return openingMatch[1];
    return null;
  } catch {
    return null;
  }
}

function formatOpeningLabel(raw?: string | null): string {
  if (!raw) return "Opening unknown";
  const trimmed = raw.trim();
  if (!trimmed) return "Opening unknown";

  try {
    if (trimmed.startsWith("http")) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const slug = parts[parts.length - 1] || parts[parts.length - 2] || trimmed;
      const decoded = decodeURIComponent(slug);
      const tokens = decoded.replace(/[-_]/g, " ").split(/\s+/);
      const filtered = tokens.filter((token) => token && !/\d/.test(token));
      const label = filtered.join(" ").trim();
      return label || "Opening unknown";
    }
  } catch {
    // fall through to plain formatting
  }

  return trimmed;
}
