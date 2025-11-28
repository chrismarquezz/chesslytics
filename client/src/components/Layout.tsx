import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
      {/* Navbar */}
      <header className="bg-white shadow-md py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <Link to="/" className="text-2xl font-bold text-[#00bfa6]">
          ♟️ ChessLab
        </Link>

        <nav className="flex space-x-6 text-lg">
          <Link
            to="/"
            className={`${
              location.pathname === "/" ? "text-[#00bfa6]" : "text-gray-700"
            } hover:text-[#00bfa6] font-medium transition`}
          >
            Home
          </Link>

          <Link
            to="/games"
            className={`${
              location.pathname === "/games" ? "text-[#00bfa6]" : "text-gray-700"
            } hover:text-[#00bfa6] font-medium transition`}
          >
            Games
          </Link>

          <Link
            to="/compare"
            className={`${
              location.pathname === "/compare" ? "text-[#00bfa6]" : "text-gray-700"
            } hover:text-[#00bfa6] font-medium transition`}
          >
            Compare
          </Link>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
