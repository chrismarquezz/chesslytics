import axios from "axios";

export async function getProfile(username: string) {
  const { data } = await axios.get(
    `https://api.chess.com/pub/player/${encodeURIComponent(username)}`
  );
  return data;
}

export async function getStats(username: string) {
  const { data } = await axios.get(
    `https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`
  );
  return data;
}

export async function getRecentGames(username: string, archives?: string[], startIndex = 0, limit = 50) {
  try {
    let archiveList = archives ?? null;
    if (!archiveList) {
      const archivesRes = await axios.get(`https://api.chess.com/pub/player/${username}/games/archives`);
      archiveList = (archivesRes.data.archives || []).reverse(); // newest first
    }
    archiveList = archiveList ?? [];

    const collected: any[] = [];
    let idx = startIndex;
    while (idx < archiveList.length && collected.length < limit) {
      const url = archiveList[idx];
      try {
        const res = await axios.get(url);
        const games = res.data.games || [];
        collected.push(...games);
      } catch {
        // skip failing archive
      }
      idx += 1;
    }

    const sorted = collected.sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0)).slice(0, limit);
    const hasMore = idx < archiveList.length;

    return { games: sorted, hasMore, archives: archiveList ?? [], nextIndex: idx };
  } catch (err) {
    console.error("Error fetching recent games:", err);
    return { games: [], hasMore: false, archives: archives ?? [], nextIndex: startIndex };
  }
}



export async function getRatingHistory(username: string, mode: "blitz" | "rapid" | "bullet" = "blitz") {
  try {
    // Step 1: Get all monthly archive URLs
    const archivesRes = await axios.get(
      `https://api.chess.com/pub/player/${username}/games/archives`
    );
    const archives: string[] = archivesRes.data.archives;

    // Step 2: Limit to last 6 months
    const recentArchives = archives.slice(-6);

    const ratingHistory: { month: string; rating: number }[] = [];

    // Step 3: Fetch each archive and collect the most recent rating
    for (const archiveUrl of recentArchives) {
      const gamesRes = await axios.get(archiveUrl);
      const games = gamesRes.data.games;

      // Find player's rating from last game of that month (for the chosen mode)
      const playerGames = games.filter(
        (g: any) =>
          g.time_class === mode &&
          (g.white.username.toLowerCase() === username.toLowerCase() ||
            g.black.username.toLowerCase() === username.toLowerCase())
      );

      if (playerGames.length > 0) {
        const lastGame = playerGames[playerGames.length - 1];
        const isWhite = lastGame.white.username.toLowerCase() === username.toLowerCase();
        const rating = isWhite ? lastGame.white.rating : lastGame.black.rating;

        const date = new Date(archiveUrl.split("/").slice(-2).join("-"));
        const month = date.toLocaleString("default", { month: "short" });

        ratingHistory.push({ month, rating });
      }
    }

    return ratingHistory;
  } catch (err) {
    console.error("Error fetching rating history:", err);
    return [];
  }
}
