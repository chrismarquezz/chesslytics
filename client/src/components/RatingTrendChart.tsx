import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface RatingTrendChartProps {
  trendData: { month: string; rating: number }[];
  selectedMode: "all" | "bullet" | "blitz" | "rapid";
}

export default function RatingTrendChart({ trendData, selectedMode }: RatingTrendChartProps) {
  return (
    <section className="bg-white shadow-lg transition-all duration-300 rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Rating Trend
      </h3>

      {selectedMode === "all" ? (
        <p className="text-gray-500 text-center py-10">
          Select a specific game mode to view its rating trend.
        </p>
      ) : trendData.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No trend data available</p>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-6 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fill: "#555" }} />
              <YAxis tick={{ fill: "#555" }} domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value: number) => `${value} rating`}
                labelStyle={{ color: "#111" }}
              />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#00bfa6"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
