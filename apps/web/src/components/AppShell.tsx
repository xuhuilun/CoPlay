import { Clapperboard, Library, LogIn, Radar } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api, type AuthProviderInfo } from "../api/client.js";

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
          <LoginMenu />
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function LoginMenu() {
  const [providers, setProviders] = useState<AuthProviderInfo[]>([]);
  const [pendingId, setPendingId] = useState("");

  useEffect(() => {
    let ignore = false;
    api.authProviders()
      .then((data) => {
        if (!ignore) {
          setProviders(data.items);
        }
      })
      .catch(() => {
        // Login is optional; guests continue silently when providers can't be loaded.
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function startLogin(provider: AuthProviderInfo) {
    if (!provider.available || pendingId) {
      return;
    }
    setPendingId(provider.id);
    try {
      const start = await api.startAuth(provider.id);
      if (start.kind === "redirect" && start.url) {
        window.location.href = start.url;
      }
    } catch {
      setPendingId("");
    }
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="login-menu">
      <LogIn size={16} />
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          className="login-provider"
          disabled={!provider.available || Boolean(pendingId)}
          title={provider.available ? `使用 ${provider.displayName} 登录` : `${provider.displayName} 登录即将开放`}
          onClick={() => void startLogin(provider)}
        >
          {provider.displayName}
        </button>
      ))}
    </div>
  );
}
