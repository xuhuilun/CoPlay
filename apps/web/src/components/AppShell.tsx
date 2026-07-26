import { Clapperboard, Library, LogIn, LogOut, Radar } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api, type AuthProviderInfo, type SessionUser } from "../api/client.js";

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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pendingId, setPendingId] = useState("");

  useEffect(() => {
    let ignore = false;
    Promise.all([api.me().catch(() => ({ user: null })), api.authProviders().catch(() => ({ items: [] }))])
      .then(([me, list]) => {
        if (!ignore) {
          setUser(me.user);
          setProviders(list.items);
        }
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

  async function logout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }

  if (user) {
    return (
      <div className="login-menu">
        <span className="login-user" title={`已登录：${user.displayName}`}>
          {user.avatarUrl && <img src={user.avatarUrl} alt="" />}
          {user.displayName}
        </span>
        <button type="button" className="login-provider" onClick={() => void logout()} title="退出登录">
          <LogOut size={16} />
        </button>
      </div>
    );
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
