import { NavLink, useLocation } from "react-router-dom";
import { User2 } from "lucide-react";

export default function Navbar() {
  const location = useLocation();

  const links = [{ to: "/", label: "Profile", icon: <User2 className="h-5 w-5" /> }];

  return (
    <nav className="fixed top-0 left-0 h-full z-50 group/nav">
      <div className="h-full bg-white border-r border-gray-200 shadow-sm w-16 group-hover/nav:w-56 transition-all duration-200 overflow-hidden">
        <div className="px-3 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#00bfa6]/10 border border-[#00bfa6]/30 flex items-center justify-center text-[#00bfa6] font-bold">
            CL
          </div>
          <span className="text-xl font-extrabold text-[#00bfa6] opacity-0 group-hover/nav:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            ChessLab
          </span>
        </div>
        <div className="mt-2">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={`flex items-center gap-3 px-3 py-3 text-sm font-semibold transition ${
                  isActive ? "text-[#00bfa6] bg-[#00bfa6]/10" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                    isActive ? "border-[#00bfa6] bg-[#00bfa6]/10 text-[#00bfa6]" : "border-gray-200 bg-gray-100 text-gray-700"
                  }`}
                >
                  {link.icon}
                </span>
                <span className="opacity-0 group-hover/nav:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                  {link.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
