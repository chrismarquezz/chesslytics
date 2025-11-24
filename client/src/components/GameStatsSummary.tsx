interface GameStatsSummaryProps {
  totalGames: number;
  winRate: string;
  avgOpponent: number | string;
  currentStreak: number;
}

export default function GameStatsSummary({
  totalGames,
  winRate,
  avgOpponent,
  currentStreak,
}: GameStatsSummaryProps) {
  const cards = [
    { title: "Games Played", value: totalGames },
    { title: "Win Rate", value: `${winRate}%`, accent: true },
    { title: "Avg Opponent Rating", value: avgOpponent },
    { title: "Current Streak", value: currentStreak },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
      {cards.map((c) => (
        <div
          key={c.title}
          className="bg-white rounded-xl shadow-lg transition-all duration-300 p-5 text-center border border-gray-100"
        >
          <h4 className="text-sm text-gray-500 font-medium mb-1">{c.title}</h4>
          <p
            className={`text-2xl font-semibold ${
              c.accent ? "text-[#00bfa6]" : "text-gray-800"
            }`}
          >
            {c.value ?? "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
