interface RatingsOverviewProps {
  stats: any;
}

export default function Ratings({ stats }: RatingsOverviewProps) {
  const ratingCards = [
    { label: "Rapid", mode: "chess_rapid" },
    { label: "Blitz", mode: "chess_blitz" },
    { label: "Bullet", mode: "chess_bullet" },
  ] as const;

  const getCurrent = (mode: string) => stats?.[mode]?.last?.rating ?? "—";
  const getPeak = (mode: string) => stats?.[mode]?.best?.rating ?? stats?.[mode]?.last?.rating ?? "—";

  const puzzleCurrent = stats?.tactics?.last?.rating ?? stats?.tactics?.highest?.rating ?? "—";
  const puzzlePeak = stats?.tactics?.highest?.rating ?? puzzleCurrent;

  const cards = [
    ...ratingCards.map(({ label, mode }) => ({
      label,
      current: getCurrent(mode),
      peak: getPeak(mode),
    })),
    {
      label: "Puzzles",
      current: puzzleCurrent,
      peak: puzzlePeak,
    },
  ];

  return (
    <section className="bg-white shadow-lg transition-all duration-300 rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Ratings
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ label, current, peak }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex flex-col gap-1"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-[#00bfa6]">
              {typeof current === "number" ? current : "—"}
            </p>
            <p className="text-sm text-gray-500">
              Peak{" "}
              <span className="font-semibold text-gray-700">
                {typeof peak === "number" ? peak : "—"}
              </span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
