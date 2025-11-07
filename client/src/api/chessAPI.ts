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

export async function getRecentGames(username: string) {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7).split("-");
  const prevMonth = new Date(now);
  prevMonth.setMonth(now.getMonth() - 1);
  const prev = prevMonth.toISOString().slice(0, 7).split("-");

  const urls = [
    `https://api.chess.com/pub/player/${username}/games/${thisMonth[0]}/${thisMonth[1]}`,
    `https://api.chess.com/pub/player/${username}/games/${prev[0]}/${prev[1]}`
  ];

  try {
    const responses = await Promise.all(
      urls.map((url) =>
        axios.get(url).then((r) => r.data.games || []).catch(() => [])
      )
    );

    // Merge and sort descending by end_time
    const merged = [...responses[0], ...responses[1]].sort(
      (a, b) => b.end_time - a.end_time
    );

    // Limit to last 100 for performance but you can tweak this
    return merged.slice(0, 100);
  } catch (err) {
    console.error("Error fetching recent games:", err);
    return [];
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

