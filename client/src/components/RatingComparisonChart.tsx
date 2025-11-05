import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RatingComparisonChartProps {
  stats: any;
}

export default function RatingComparisonChart({ stats }: RatingComparisonChartProps) {
  const data = [
    { name: "Rapid", rating: stats.chess_rapid?.last?.rating || 0 },
    { name: "Blitz", rating: stats.chess_blitz?.last?.rating || 0 },
    { name: "Bullet", rating: stats.chess_bullet?.last?.rating || 0 },
  ];

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
      <h2 className="text-2xl font-semibold text-[#00bfa6] mb-4">
        📊 Rating Comparison
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="rating" fill="#00bfa6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
