import axios from "axios";

export interface ExplorerMove {
  san: string;
  uci: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
}

export interface ExplorerOpening {
  eco?: string;
  name?: string;
}

export interface ExplorerResponse {
  fen: string;
  moves: ExplorerMove[];
  opening?: ExplorerOpening;
  total: number;
}

type CacheEntry = { timestamp: number; data: ExplorerResponse };

const bookCache = new Map<string, CacheEntry>();
const BOOK_CACHE_TTL = 1000 * 60 * 10; // 10 minutes

export async function fetchBookMoves(fen: string, limit = 8): Promise<ExplorerResponse> {
  const cached = bookCache.get(fen);
  if (cached && Date.now() - cached.timestamp < BOOK_CACHE_TTL) {
    return cached.data;
  }

  const movesParam = Math.max(3, Math.min(limit, 15));
  const url = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&topGames=0&moves=${movesParam}`;

  const response = await axios.get(url, { timeout: 5000 });
  const data = response.data ?? {};
  const rawMoves: ExplorerMove[] = Array.isArray(data.moves) ? data.moves : [];
  const normalizedMoves = rawMoves.slice(0, movesParam).map((move) => {
    const white = move.white ?? 0;
    const draws = move.draws ?? 0;
    const black = move.black ?? 0;
    return {
      san: move.san,
      uci: move.uci,
      white,
      draws,
      black,
      total: white + draws + black,
      averageRating: move.averageRating,
    };
  });
  const totalGames = normalizedMoves.reduce((sum, move) => sum + move.total, 0);
  const normalized: ExplorerResponse = {
    fen,
    moves: normalizedMoves,
    opening: data.opening,
    total: totalGames,
  };
  bookCache.set(fen, { timestamp: Date.now(), data: normalized });
  return normalized;
}
