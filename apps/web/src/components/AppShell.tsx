import { Clapperboard, Library, Radar } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="CoPlay home">
          <span className="brand-mark">
            <Clapperboard size={18} />
          </span>
          <span>CoPlay</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/">
            <Radar size={17} />
            发现
          </NavLink>
          <NavLink to="/library">
            <Library size={17} />
            视频库
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
