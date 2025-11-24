export interface QualityCard {
  title: string;
  value: number;
  accent: string;
}

export interface FindingRow {
  id: number;
  moveLabel: string;
  played: string;
  qualityLabel: string;
  badgeClass: string;
  bestMove: string;
  evalText: string;
  deltaLabel: string;
}

interface EngineFindingsCardProps {
  qualityCards: QualityCard[];
  rows: FindingRow[];
}

export default function EngineFindingsCard({ qualityCards, rows }: EngineFindingsCardProps) {
  return (
    <section className="bg-white shadow-lg transition-all duration-300 rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">Engine Findings</h2>
        <span className="text-xs uppercase tracking-wide text-gray-500">Live evaluations ({rows.length})</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {qualityCards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 text-center"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">{card.title}</p>
            <p className={`text-2xl font-bold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>
      {rows.length ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-x-auto">
          <table className="min-w-full text-sm text-gray-700">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Move</th>
                <th className="text-left px-4 py-3">Played</th>
                <th className="text-left px-4 py-3">Quality</th>
                <th className="text-left px-4 py-3">Engine Suggestion</th>
                <th className="text-right px-4 py-3">Eval (Δ)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-200">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.moveLabel}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{row.played}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.badgeClass}`}>
                      {row.qualityLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.bestMove}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-semibold text-[#00bfa6]">{row.evalText}</span>
                    <span className="text-xs text-gray-500 ml-2">{row.deltaLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Run an analysis or click through moves on the board to start building a findings list.
        </p>
      )}
    </section>
  );
}
