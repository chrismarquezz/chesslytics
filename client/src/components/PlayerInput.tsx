import React from "react";

interface PlayerInputProps {
  username: string;
  setUsername: (name: string) => void;
  onFetch: () => void;
  loading: boolean;
}

export default function PlayerInput({
  username,
  setUsername,
  onFetch,
  loading,
}: PlayerInputProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
      <input
        type="text"
        placeholder="Enter Chess.com username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="px-4 py-2 w-72 rounded-md border border-gray-300 text-gray-800 text-lg focus:outline-none focus:ring-2 focus:ring-[#00bfa6]"
      />
      <button
        onClick={onFetch}
        disabled={loading}
        className={`${
          loading ? "opacity-60 cursor-not-allowed" : "hover:bg-[#00d6b5]"
        } bg-[#00bfa6] text-white font-semibold px-6 py-2 rounded-md transition`}
      >
        {loading ? "Loading..." : "Fetch Analytics"}
      </button>
    </div>
  );
}
