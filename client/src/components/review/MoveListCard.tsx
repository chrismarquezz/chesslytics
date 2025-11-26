import type { BookMoveStatus, MoveQuality, MoveSnapshot } from "../../types/review";

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
  moveClassifications: Record<number, MoveQuality | undefined>;
  bookStatuses: Record<number, BookMoveStatus | undefined>;
}

export default function MoveListCard({
  movePairs,
  currentMoveIndex,
  onSelectMove,
  moveClassifications: _moveClassifications,
  bookStatuses: _bookStatuses,
}: MoveListCardProps) {
  void _moveClassifications;
  void _bookStatuses;
  const renderButton = (move?: MoveSnapshot, index?: number) => {
    if (!move || index === undefined || index < 0) {
      return <span className="block text-center text-gray-400">—</span>;
    }
    const isActive = currentMoveIndex === index;
    const baseClass = isActive ? "bg-[#00bfa6]/10 text-[#00bfa6]" : "hover:bg-white";
    return (
      <button
        data-move-index={index}
        className={`w-full text-center px-2 py-1 rounded-lg transition ${baseClass}`}
        onClick={() => onSelectMove(index)}
      >
        <div className="flex items-center justify-center gap-2">
          <span>{move.san}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="bg-white shadow-lg transition-all duration-300 rounded-2xl border border-gray-200 overflow-hidden">
      <div className="max-h-110 overflow-y-auto bg-gray-50" data-move-list>
        {movePairs.length ? (
          <table className="w-full text-sm text-gray-700 table-fixed">
            <thead className="text-xs uppercase tracking-wide text-gray-100 bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-1 text-center font-semibold w-[10%]">#</th>
                <th className="py-3 px-1 text-center font-semibold w-[30%]">White</th>
                <th className="py-3 px-1 text-center font-semibold w-[30%]">Black</th>
              </tr>
            </thead>
            <tbody className="bg-gray-50">
              {movePairs.map((pair) => (
                <tr key={pair.moveNumber} className="border-b border-gray-200 last:border-none">
                  <td className="py-2 px-1 text-xs font-mono text-gray-500 text-center align-middle whitespace-nowrap">
                    {pair.moveNumber}
                  </td>
                  <td className="py-1 px-1">{renderButton(pair.white, pair.whiteIndex)}</td>
                  <td className="py-1 px-1">{renderButton(pair.black, pair.blackIndex)}</td>
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
