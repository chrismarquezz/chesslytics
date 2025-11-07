import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

interface WinLossPieChartProps {
  stats: any;
  selectedMode: "all" | "bullet" | "blitz" | "rapid";
}

export default function WinLossPieChart({ stats, selectedMode }: WinLossPieChartProps) {
  const data = (() => {
    if (selectedMode === "all") {
      const total = ["chess_bullet", "chess_blitz", "chess_rapid"].map(
        (m) => stats[m]?.record ?? { win: 0, loss: 0, draw: 0 }
      );
      return {
        win: total.reduce((s, r) => s + (r.win ?? 0), 0),
        loss: total.reduce((s, r) => s + (r.loss ?? 0), 0),
        draw: total.reduce((s, r) => s + (r.draw ?? 0), 0),
      };
    }
    const modeKey = `chess_${selectedMode}`;
    return stats[modeKey]?.record ?? { win: 0, loss: 0, draw: 0 };
  })();

  const chartData = [
    { name: "Wins", value: data.win, color: "#00bfa6" },
    { name: "Losses", value: data.loss, color: "#ef4444" },
    { name: "Draws", value: data.draw, color: "#9ca3af" },
  ];

  const totalGames = data.win + data.loss + data.draw;
  const getPercent = (val: number) =>
    totalGames ? ((val / totalGames) * 100).toFixed(1) + "%" : "0%";

  return (
    <section className="bg-white shadow-md rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Win / Loss Distribution
      </h3>

      {totalGames === 0 ? (
        <p className="text-gray-500 text-center mt-10">No data available</p>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-full h-80">
            <ResponsiveContainer>
              <ResponsiveContainer>
  <PieChart>
    <Pie
      data={chartData}
      cx="50%"
      cy="50%"
      labelLine={false}
      outerRadius={110}
      dataKey="value"
      label={({ name, value }) => `${name} (${getPercent(value as number)})`} // ✅ fix here
    >
      {chartData.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={entry.color} />
      ))}
    </Pie>
    <Tooltip formatter={(val: number | string) => `${val} games`} />
    <Legend
      verticalAlign="bottom"
      align="center"
      iconType="circle"
      wrapperStyle={{ paddingTop: 20 }}
    />
  </PieChart>
</ResponsiveContainer>

            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
