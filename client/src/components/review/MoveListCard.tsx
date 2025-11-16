import type { MoveSnapshot } from "../../types/review";

export interface MovePair {
  moveNumber: number;
  white?: MoveSnapshot;
  black?: MoveSnapshot;
  whiteIndex: number;
  blackIndex: number;
}

interface MoveListCardProps {
  movePairs: MovePair[];
  currentMoveIndex: number;
  onSelectMove: (index: number) => void;
}

export default function MoveListCard({ movePairs, currentMoveIndex, onSelectMove }: MoveListCardProps) {
  return (
    <div className="bg-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 rounded-2xl border border-gray-200 overflow-hidden">
      <div className="max-h-110 overflow-y-auto bg-gray-50" data-move-list>
        {movePairs.length ? (
          <table className="w-full text-sm text-gray-700">
            <thead className="text-xs uppercase tracking-wide text-gray-100 bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="py-3 pr-4 text-center font-semibold">#</th>
                <th className="py-3 px-4 text-center font-semibold">White</th>
                <th className="py-3 px-4 text-center font-semibold">Black</th>
              </tr>
            </thead>
            <tbody className="bg-gray-50">
              {movePairs.map((pair) => (
                <tr key={pair.moveNumber} className="border-b border-gray-200 last:border-none">
                  <td className="py-2 pr-4 text-xs font-mono text-gray-500 text-center">{pair.moveNumber}</td>
                  <td className="py-1 px-4">
                    {pair.white ? (
                      <button
                        data-move-index={pair.whiteIndex}
                        className={`w-full text-center px-2 py-1 rounded-lg transition ${
                          currentMoveIndex === pair.whiteIndex ? "bg-[#00bfa6]/10 text-[#00bfa6]" : "hover:bg-white"
                        }`}
                        onClick={() => onSelectMove(pair.whiteIndex)}
                      >
                        {pair.white.san}
                      </button>
                    ) : (
                      <span className="block text-center text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-1 px-4">
                    {pair.black ? (
                      <button
                        data-move-index={pair.blackIndex}
                        className={`w-full text-center px-2 py-1 rounded-lg transition ${
                          currentMoveIndex === pair.blackIndex ? "bg-[#00bfa6]/10 text-[#00bfa6]" : "hover:bg-white"
                        }`}
                        onClick={() => onSelectMove(pair.blackIndex)}
                      >
                        {pair.black.san}
                      </button>
                    ) : (
                      <span className="block text-center text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-gray-500">Load a PGN to populate moves.</p>
        )}
      </div>
    </div>
  );
}
