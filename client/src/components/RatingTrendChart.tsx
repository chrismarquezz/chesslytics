import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type RatingPoint = {
  month: string;
  rating: number;
};

type RatingTrendChartProps = {
  trendData: RatingPoint[];
  selectedTrendMode: "blitz" | "rapid" | "bullet";
  setSelectedTrendMode: React.Dispatch<
    React.SetStateAction<"blitz" | "rapid" | "bullet">
  >;
};

export default function RatingTrendChart({
  trendData,
  selectedTrendMode,
  setSelectedTrendMode,
}: RatingTrendChartProps) {
  return (
    <div className="bg-white shadow-md rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800">
          Rating Trend ({selectedTrendMode})
        </h3>

        <select
          value={selectedTrendMode}
          onChange={(e) =>
            setSelectedTrendMode(e.target.value as "blitz" | "rapid" | "bullet")
          }
          className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-[#00bfa6] focus:outline-none"
        >
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
          <option value="bullet">Bullet</option>
        </select>
      </div>

      {trendData && trendData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #ddd",
              }}
            />
            <Line
              type="monotone"
              dataKey="rating"
              stroke="#00bfa6"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-gray-500 text-center">No rating data available</p>
      )}
    </div>
  );
}
