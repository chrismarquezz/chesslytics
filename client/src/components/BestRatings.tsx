import React from "react";

interface BestRatingsProps {
  stats: any;
}

export default function BestRatings({ stats }: BestRatingsProps) {
  const modes = ["chess_rapid", "chess_blitz", "chess_bullet"];

  const getLabel = (mode: string) => mode.replace("chess_", "").toUpperCase();

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
      <h3 className="text-2xl text-center font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Best Ratings
      </h3>

      <table className="w-full text-lg text-gray-700">
        <thead>
          <tr className="text-left border-b border-gray-200">
            <th className="py-2">Mode</th>
            <th>Current</th>
            <th>Best</th>
            <th>Off Peak</th>
          </tr>
        </thead>
        <tbody>
          {modes.map((mode) => {
            const current = stats[mode]?.last?.rating ?? "—";
            const best = stats[mode]?.best?.rating ?? "—";
            const offPeak =
              typeof current === "number" && typeof best === "number"
                ? current - best
                : null;

            const color =
              offPeak === null
                ? "text-gray-600"
                : offPeak === 0
                ? "text-[#00bfa6]"
                : offPeak < 0
                ? "text-red-500"
                : "text-[#00bfa6]";

            return (
              <tr key={mode} className="border-b border-gray-100 last:border-0">
                <td className="py-2 font-medium">{getLabel(mode)}</td>
                <td className="py-2">{current}</td>
                <td className="py-2">{best}</td>
                <td className={`py-2 font-semibold ${color}`}>
                  {offPeak === null
                    ? "—"
                    : offPeak === 0
                    ? "Peak"
                    : `${offPeak > 0 ? "+" : ""}${offPeak}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
