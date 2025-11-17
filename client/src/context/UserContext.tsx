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
  gamesError: string | null;
  refreshGames: () => void;
  profile: any | null;
  stats: any | null;
  trendHistory: TrendHistory;
  userDataLoading: boolean;
  userDataError: string | null;
  fetchUserData: (usernameOverride?: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USERNAME_STORAGE_KEY = "chesslytics-username";

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameState] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(USERNAME_STORAGE_KEY) ?? "";
    }
    return "";
  });
  const [games, setGames] = useState<any[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
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

  const fetchGames = useCallback(async () => {
    if (!username.trim()) {
      setGames([]);
      setGamesError(null);
      setGamesLoading(false);
      return;
    }

    setGamesLoading(true);
    setGamesError(null);
    try {
      const data = await getRecentGames(username);
      const sorted = [...data].sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0));
      setGames(sorted);
    } catch (err) {
      console.error("Failed to fetch recent games:", err);
      setGames([]);
      setGamesError("Could not load recent games.");
    } finally {
      setGamesLoading(false);
    }
  }, [username]);

  const refreshGames = useCallback(() => {
    void fetchGames();
  }, [fetchGames]);

  const fetchUserData = useCallback(
    async (usernameOverride?: string) => {
      const target = (usernameOverride ?? username).trim();
      if (!target) return;

      setUserDataLoading(true);
      setUserDataError(null);
      try {
        const [profileData, statsData, blitzHistory, rapidHistory, bulletHistory] = await Promise.all([
          getProfile(target),
          getStats(target),
          getRatingHistory(target, "blitz"),
          getRatingHistory(target, "rapid"),
          getRatingHistory(target, "bullet"),
        ]);

        setProfile(profileData);
        setStats(statsData);
        setTrendHistory({
          blitz: blitzHistory,
          rapid: rapidHistory,
          bullet: bulletHistory,
        });
      } catch (err) {
        console.error("Failed to fetch player data:", err);
        setUserDataError("Could not fetch data. Please try again.");
      } finally {
        setUserDataLoading(false);
      }
    },
    [username]
  );

  useEffect(() => {
    void fetchGames();
  }, [fetchGames]);

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
        gamesError,
        refreshGames,
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
