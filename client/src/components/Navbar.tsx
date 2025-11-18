import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export default function Navbar() {
  const location = useLocation();

  const links = [
    { to: "/", label: "Profile" },
    { to: "/review", label: "Review" },
    // { to: "/compare", label: "Compare" },
  ];

  return (
    <nav className="w-full bg-white/90 backdrop-blur-sm shadow-sm fixed top-0 left-0 z-50">
      <div className="w-full flex justify-between items-center h-16 px-8">
        {/* === Brand === */}
        <NavLink
          to="/"
          className="text-2xl font-extrabold text-[#00bfa6] tracking-tight hover:opacity-90 transition"
        >
        Chesslytics
        </NavLink>

        {/* === Links === */}
        <div className="flex gap-8 relative">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <div key={link.to} className="relative">
                <NavLink
                  to={link.to}
                  end
                  className={`text-lg font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-[#00bfa6] font-semibold"
                      : "text-gray-700 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </NavLink>
                {isActive && (
                  <motion.div
                    layoutId="navbar-underline"
                    className="absolute left-0 right-0 h-[2px] bg-[#00bfa6] rounded-full"
                    style={{ bottom: -3 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
