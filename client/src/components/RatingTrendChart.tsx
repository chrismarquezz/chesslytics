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

export default function RatingTrendChart({
  trendData,
}: RatingTrendChartProps) {
  return (
    <section className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Rating Trend
      </h3>

      {trendData.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No trend data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
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
      )}
    </section>
  );
}
