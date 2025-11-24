interface SummaryCard {
  title: string;
  value: string | number;
  subtext: string;
  accent: string;
}

interface SummaryGridProps {
  cards: SummaryCard[];
}

export default function SummaryGrid({ cards }: SummaryGridProps) {
  return (
    <div className="bg-white shadow-lg transition-all duration-300 rounded-2xl border border-gray-200 p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Review Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">{card.title}</p>
            <p className={`text-3xl font-bold ${card.accent}`}>{card.value}</p>
            <p className="text-sm text-gray-500">{card.subtext}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500 mt-4">
        Numbers update once analysis runs. Toggle through the tabs above to shape future review modules.
      </p>
    </div>
  );
}
