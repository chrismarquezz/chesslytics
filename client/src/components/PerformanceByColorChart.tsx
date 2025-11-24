import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";

interface PerformanceByColorChartProps {
  games: any[];
  username: string;
}

export default function PerformanceByColorChart({
  games,
  username,
}: PerformanceByColorChartProps) {
  if (!games.length) return null;

  let whiteWins = 0,
    whiteGames = 0;
  let blackWins = 0,
    blackGames = 0;

  // Count results by color
  for (const game of games) {
    const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
    const result = isWhite ? game.white.result : game.black.result;

    if (isWhite) {
      whiteGames++;
      if (result === "win") whiteWins++;
    } else {
      blackGames++;
      if (result === "win") blackWins++;
    }
  }

  const winRateWhite =
    whiteGames > 0 ? ((whiteWins / whiteGames) * 100).toFixed(1) : "0";
  const winRateBlack =
    blackGames > 0 ? ((blackWins / blackGames) * 100).toFixed(1) : "0";

  const data = [
    { color: "White", winRate: parseFloat(winRateWhite) },
    { color: "Black", winRate: parseFloat(winRateBlack) },
  ];

  const barColors = ["#e5e7eb", "#374151"]; // light gray for white, dark gray for black

  return (
    <section className="bg-white shadow-lg transition-all duration-300 rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Performance by Color
      </h3>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="color"
              tick={{ fill: "#4b5563", fontSize: 14, fontWeight: 500 }}
              width={70}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Win Rate"]}
            />
            <Bar
              dataKey="winRate"
              radius={[6, 6, 6, 6]}
              barSize={35}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={barColors[index]} />
              ))}
              <LabelList
                dataKey="winRate"
                position="right"
                formatter={(label) =>
                  typeof label === "number" ? `${label.toFixed(1)}%` : ""
                }
                fill="#00bfa6"
                fontSize={14}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
