interface PerformanceInsightsProps {
  avgRating: number | null;
  bestMode: string | null;
}

export default function PerformanceInsights({
  avgRating,
  bestMode,
}: PerformanceInsightsProps) {
  return (
    <section className="bg-white shadow-lg transition-all duration-300 rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Performance Insights
      </h3>
      <ul className="space-y-2 text-lg">
        <li>
          Average Rating:{" "}
          <span className="font-mono font-semibold text-[#00bfa6]">
            {avgRating ?? "N/A"}
          </span>
        </li>
        <li>
          Best Mode:{" "}
          <span className="font-semibold text-[#00bfa6]">
            {bestMode || "N/A"}
          </span>
        </li>
      </ul>
    </section>
  );
}
