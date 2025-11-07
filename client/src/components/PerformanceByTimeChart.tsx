import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

interface PerformanceByTimeChartProps {
  games: any[];
  username: string;
}

export default function PerformanceByTimeChart({
  games,
  username,
}: PerformanceByTimeChartProps) {
  const data = useMemo(() => {
    if (!games?.length || !username) return [];

    const buckets = {
      morning: { label: "Morning ☀️", wins: 0, total: 0 },
      afternoon: { label: "Afternoon 🌤", wins: 0, total: 0 },
      evening: { label: "Evening 🌙", wins: 0, total: 0 },
    };

    for (const game of games) {
      const date = new Date(game.end_time * 1000);
      const hour = date.getHours();

      let bucketKey: keyof typeof buckets;
      if (hour >= 5 && hour < 11) bucketKey = "morning";
      else if (hour >= 11 && hour < 17) bucketKey = "afternoon";
      else bucketKey = "evening";

      const isWhite =
        game.white.username?.toLowerCase() === username.toLowerCase();
      const playerResult = isWhite ? game.white.result : game.black.result;

      if (playerResult) {
        buckets[bucketKey].total++;
        if (playerResult === "win") buckets[bucketKey].wins++;
      }
    }

    return Object.values(buckets)
      .filter((b) => b.total > 0)
      .map((b) => ({
        label: b.label,
        winRate: parseFloat(((b.wins / b.total) * 100).toFixed(1)),
      }));
  }, [games, username]);

  if (!data.length)
    return (
      <section className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl p-6 border border-gray-200">
        <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
          Performance by Time of Day
        </h3>
        <p className="text-gray-500">Not enough data to display.</p>
      </section>
    );

  return (
    <section className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Performance by Time of Day
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
          barCategoryGap="25%"
        >
          <XAxis dataKey="label" axisLine={false} tickLine={false} />
          <YAxis hide domain={[0, 100]} />
          <Tooltip formatter={(value: number) => `${value}% win rate`} />
          <Bar dataKey="winRate" fill="#00bfa6" radius={[6, 6, 0, 0]}>
            <LabelList
              dataKey="winRate"
              position="top"
              content={(props) => {
                const { x, y, value } = props;
                const yPos = typeof y === "number" ? y - 5 : 0; // ✅ fix
                return (
                  <text
                    x={x}
                    y={yPos}
                    textAnchor="middle"
                    fill="#374151"
                    fontSize={12}
                    fontWeight="500"
                  >
                    {value}%
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-sm text-gray-500 text-center mt-4">
        Based on recent games
      </p>
    </section>
  );
}
