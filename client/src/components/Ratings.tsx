import React from "react";

interface RatingsOverviewProps {
  stats: any;
}

export default function Ratings({ stats }: RatingsOverviewProps) {
  return (
    <section className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl p-6 border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Ratings
      </h3>
      <ul className="space-y-2 text-lg">
        <li>
          Rapid:{" "}
          <span className="font-mono font-semibold text-[#00bfa6]">
            {stats.chess_rapid?.last?.rating ?? "N/A"}
          </span>
        </li>
        <li>
          Blitz:{" "}
          <span className="font-mono font-semibold text-[#00bfa6]">
            {stats.chess_blitz?.last?.rating ?? "N/A"}
          </span>
        </li>
        <li>
          Bullet:{" "}
          <span className="font-mono font-semibold text-[#00bfa6]">
            {stats.chess_bullet?.last?.rating ?? "N/A"}
          </span>
        </li>
        <li>
          Puzzles:{" "}
          <span className="font-mono font-semibold text-[#00bfa6]">
            {stats.tactics?.highest?.rating ?? "N/A"}
          </span>
        </li>
      </ul>
    </section>
  );
}
