import React from "react";

interface RatingsOverviewProps {
  stats: any;
}

export default function RatingsOverview({ stats }: RatingsOverviewProps) {
  return (
    <section className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
      <h2 className="text-2xl font-semibold text-[#00bfa6] mb-4">
        🎯 Ratings Overview
      </h2>
      <ul className="space-y-2 text-lg">
        <li>
          Rapid:{" "}
          <span className="font-mono font-semibold">
            {stats.chess_rapid?.last?.rating ?? "N/A"}
          </span>
        </li>
        <li>
          Blitz:{" "}
          <span className="font-mono font-semibold">
            {stats.chess_blitz?.last?.rating ?? "N/A"}
          </span>
        </li>
        <li>
          Bullet:{" "}
          <span className="font-mono font-semibold">
            {stats.chess_bullet?.last?.rating ?? "N/A"}
          </span>
        </li>
        <li>
          Puzzles:{" "}
          <span className="font-mono font-semibold">
            {stats.tactics?.highest?.rating ?? "N/A"}
          </span>
        </li>
      </ul>
    </section>
  );
}
