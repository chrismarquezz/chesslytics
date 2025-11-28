import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getRecentGames, getProfile, getStats, getRatingHistory } from "../api/chessAPI";

type RatingPoint = { month: string; rating: number };
type TrendHistory = {
  blitz: RatingPoint[];
  rapid: RatingPoint[];
  bullet: RatingPoint[];
};

interface UserContextType {
  username: string;
  setUsername: (value: string) => void;
  games: any[];
  gamesLoading: boolean;
  loadMoreLoading: boolean;
  gamesError: string | null;
  refreshGames: () => void;
  loadMoreGames: () => void;
  hasMoreGames: boolean;
  profile: any | null;
  stats: any | null;
  trendHistory: TrendHistory;
  userDataLoading: boolean;
  userDataError: string | null;
  fetchUserData: (usernameOverride?: string) => Promise<boolean>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USERNAME_STORAGE_KEY = "chesslab-username";

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameState] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(USERNAME_STORAGE_KEY) ?? "";
    }
    return "";
  });
  const [games, setGames] = useState<any[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [trendHistory, setTrendHistory] = useState<TrendHistory>({
    blitz: [],
    rapid: [],
    bullet: [],
  });
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [userDataError, setUserDataError] = useState<string | null>(null);
  const [hasMoreGames, setHasMoreGames] = useState(false);
  const [archivesCache, setArchivesCache] = useState<string[] | null>(null);
  const [archiveIndex, setArchiveIndex] = useState(0);

  const persistedSetUsername = useCallback((value: string) => {
    setUsernameState(value);
    if (typeof window !== "undefined") {
      if (value.trim()) {
        window.localStorage.setItem(USERNAME_STORAGE_KEY, value.trim());
      } else {
        window.localStorage.removeItem(USERNAME_STORAGE_KEY);
      }
    }
  }, []);

  const fetchUserData = useCallback(
    async (usernameOverride?: string) => {
      const target = (usernameOverride ?? username).trim();
      if (!target) {
        setProfile(null);
        setStats(null);
        setTrendHistory({
          blitz: [],
          rapid: [],
          bullet: [],
        });
      setGames([]);
      setGamesError(null);
      setUserDataError(null);
      setHasMoreGames(false);
      setArchivesCache(null);
      setArchiveIndex(0);
      setLoadMoreLoading(false);
      return false;
    }

    setUserDataLoading(true);
    setGamesLoading(true);
    setLoadMoreLoading(false);
    setUserDataError(null);
    setGamesError(null);
    try {
      const [profileData, statsData, blitzHistory, rapidHistory, bulletHistory, gamesData] = await Promise.all([
        getProfile(target),
          getStats(target),
          getRatingHistory(target, "blitz"),
          getRatingHistory(target, "rapid"),
          getRatingHistory(target, "bullet"),
          getRecentGames(target, undefined, 0, 50),
        ]);

        setProfile(profileData);
        setStats(statsData);
        setTrendHistory({
          blitz: blitzHistory,
          rapid: rapidHistory,
          bullet: bulletHistory,
        });
        setGames(gamesData.games);
        setHasMoreGames(gamesData.hasMore ?? false);
        setArchivesCache(gamesData.archives ?? null);
        setArchiveIndex(gamesData.nextIndex ?? 0);
        return true;
      } catch (err) {
        console.error("Failed to fetch player data:", err);
        setUserDataError("Account not found. Please check the username.");
        setGames([]);
        setGamesError("Could not load recent games.");
        setHasMoreGames(false);
        setArchivesCache(null);
        setArchiveIndex(0);
        return false;
      } finally {
        setUserDataLoading(false);
        setGamesLoading(false);
      }
    },
    [username]
  );

  const refreshGames = useCallback(() => {
    void fetchUserData(username);
  }, [fetchUserData, username]);

  const loadMoreGames = useCallback(async () => {
    const target = username.trim();
    if (!target || !hasMoreGames) return;
    setLoadMoreLoading(true);
    setGamesError(null);
    try {
      const more = await getRecentGames(target, archivesCache ?? undefined, archiveIndex, 50);
      const combined = [...games, ...more.games];
      const deduped = Array.from(new Map(combined.map((g) => [g.url, g])).values()).sort(
        (a, b) => (b.end_time ?? 0) - (a.end_time ?? 0)
      );
      setGames(deduped);
      setHasMoreGames(more.hasMore ?? false);
      setArchivesCache(more.archives ?? archivesCache);
      setArchiveIndex(more.nextIndex ?? archiveIndex);
    } catch (err) {
      console.error("Failed to load more games:", err);
      setGamesError("Could not load more games.");
    } finally {
      setLoadMoreLoading(false);
    }
  }, [archiveIndex, archivesCache, games, hasMoreGames, username]);

  useEffect(() => {
    if (username.trim()) {
      void fetchUserData(username);
    }
  }, [username, fetchUserData]);

  return (
    <UserContext.Provider
      value={{
        username,
        setUsername: persistedSetUsername,
        games,
        gamesLoading,
        loadMoreLoading,
        gamesError,
        refreshGames,
        loadMoreGames,
        hasMoreGames,
        profile,
        stats,
        trendHistory,
        userDataLoading,
        userDataError,
        fetchUserData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
