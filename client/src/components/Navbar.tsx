import { NavLink, useLocation } from "react-router-dom";
import { User2 } from "lucide-react";

interface NavbarProps {
  avatarUrl?: string | null;
  username?: string | null;
  onAvatarClick?: () => void;
  belowTopBar?: boolean;
}

export default function Navbar({ avatarUrl, username, onAvatarClick, belowTopBar = false }: NavbarProps) {
  const location = useLocation();
  const initial = username?.charAt(0)?.toUpperCase() ?? "U";

  const links = [{ to: "/", label: "Home", icon: <User2 className="h-5 w-5" /> }];

  return (
    <nav className={`fixed left-0 z-50 group/nav ${belowTopBar ? "top-8 h-[calc(100%-2rem)]" : "top-0 h-full"}`}>
      <div className="h-full bg-white border-r border-gray-200 shadow-sm w-16 group-hover/nav:w-56 transition-all duration-200 overflow-hidden flex flex-col">
        <div className="px-3 py-4 flex items-center gap-3 justify-center group-hover/nav:justify-start">
          <div className="h-10 w-10 rounded-xl bg-[#00bfa6]/10 border border-[#00bfa6]/30 flex items-center justify-center text-[#00bfa6] font-bold flex-shrink-0">
            CL
          </div>
          <span className="hidden group-hover/nav:inline text-xl font-extrabold text-[#00bfa6] transition-opacity duration-200 whitespace-nowrap">
            ChessLab
          </span>
        </div>
        <div className="h-px bg-gray-200 w-full" />
        <div className="mt-2 flex-1">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={`flex items-center gap-3 px-3 py-3 text-sm font-semibold transition justify-center group-hover/nav:justify-start ${
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
                <span className="hidden group-hover/nav:inline transition-opacity duration-200 whitespace-nowrap">
                  {link.label}
                </span>
              </NavLink>
            );
          })}
        </div>
        {onAvatarClick ? (
          <div className="w-full">
            <div className="h-px bg-gray-200 mb-3 w-full" />
            <div className="px-3 pb-3">
              <div className="relative group/avatar">
                <button
                  onClick={onAvatarClick}
                  aria-label="Change username"
                  className="w-full flex items-center gap-3 px-3 py-.5 text-sm font-semibold text-gray-900 justify-center group-hover/nav:justify-start"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-gray-200 overflow-hidden flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile avatar" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="text-gray-700 font-semibold">{initial}</span>
                    )}
                  </span>
                  <span className="hidden group-hover/nav:inline transition-opacity duration-200 whitespace-nowrap">
                    {username || "Set username"}
                  </span>
                </button>
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-9 px-2 py-1 text-xs font-semibold text-white bg-gray-900 rounded-md opacity-0 group-hover/avatar:opacity-90 transition-opacity text-center whitespace-nowrap shadow">
                  Change username
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
