import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface WinLossPieChartProps {
  stats: any;
  selectedMode: "blitz" | "rapid" | "bullet";
  setSelectedMode: (mode: "blitz" | "rapid" | "bullet") => void;
}

export default function WinLossPieChart({
  stats,
  selectedMode,
  setSelectedMode,
}: WinLossPieChartProps) {
  const modeData =
    stats && stats[`chess_${selectedMode}`]?.record
      ? [
          { name: "Wins", value: stats[`chess_${selectedMode}`].record.win || 0 },
          { name: "Losses", value: stats[`chess_${selectedMode}`].record.loss || 0 },
          { name: "Draws", value: stats[`chess_${selectedMode}`].record.draw || 0 },
        ]
      : [];

  const totalGames = modeData.reduce((acc, cur) => acc + cur.value, 0);
  const COLORS = ["#00bfa6", "#f87171", "#facc15"]; // green, red, yellow

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-[#00bfa6]">
          🥧 Win/Loss/Draw Ratio
        </h2>
        <select
          value={selectedMode}
          onChange={(e) =>
            setSelectedMode(e.target.value as "blitz" | "rapid" | "bullet")
          }
          className="border border-gray-300 rounded-md px-2 py-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00bfa6]"
        >
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
          <option value="bullet">Bullet</option>
        </select>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={modeData}
            cx="50%"
            cy="50%"
            outerRadius={90}
            dataKey="value"
            labelLine={false}
            label={(entry: any) =>
              totalGames
                ? `${entry.name}: ${((Number(entry.value) / totalGames) * 100).toFixed(1)}%`
                : `${entry.name}: 0%`
            }
          >
            {modeData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: "32px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </section>
  );
}
