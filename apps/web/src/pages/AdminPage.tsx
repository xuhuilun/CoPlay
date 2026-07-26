import { Ban, RefreshCcw, ShieldCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type AdminCacheJob, type AdminUsage, type AdminUser } from "../api/client.js";
import { PageState } from "../components/PageState.js";

const STATUSES = ["queued", "downloading", "uploading", "completed", "failed", "cancelled"] as const;
const ACTIVE_STATUSES = new Set(["queued", "downloading", "uploading"]);

export function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [jobs, setJobs] = useState<AdminCacheJob[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [notice, setNotice] = useState("");

  const loadJobs = useCallback(async (status: string) => {
    const data = await api.admin.cacheJobs(status || undefined);
    setJobs(data.items);
  }, []);

  const reloadAll = useCallback(
    async (status: string) => {
      const [usageData, usersData] = await Promise.all([api.admin.usage(), api.admin.users()]);
      setUsage(usageData);
      setUsers(usersData.items);
      await loadJobs(status);
    },
    [loadJobs]
  );

  useEffect(() => {
    api.admin
      .me()
      .then(() => {
        setAuthorized(true);
        return reloadAll("");
      })
      .catch(() => setAuthorized(false));
  }, [reloadAll]);

  async function act(run: () => Promise<unknown>, message: string) {
    try {
      await run();
      await reloadAll(statusFilter);
      setNotice(message);
    } catch {
      setNotice("操作失败，请重试");
    }
  }

  function onFilterChange(status: string) {
    setStatusFilter(status);
    loadJobs(status).catch(() => setNotice("任务列表加载失败"));
  }

  if (authorized === null) {
    return <PageState tone="loading" title="正在校验管理员权限" />;
  }
  if (!authorized) {
    return (
      <PageState tone="empty" title="需要管理员权限">
        请使用在 ADMIN_GITHUB_IDS 白名单中的 GitHub 账号登录后访问。
      </PageState>
    );
  }

  return (
    <section className="admin-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>
            <ShieldCheck size={22} /> 管理后台
          </h1>
        </div>
      </div>
      {notice && <div className="status-strip">{notice}</div>}

      {usage && (
        <div className="admin-usage">
          <div className="stat-tile">
            <span>任务总数</span>
            <strong>{usage.jobs.total}</strong>
          </div>
          <div className="stat-tile">
            <span>视频库</span>
            <strong>{usage.librarySize}</strong>
          </div>
          {STATUSES.map((status) => (
            <div className="stat-tile" key={status}>
              <span>{status}</span>
              <strong>{usage.jobs.byStatus[status] ?? 0}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="admin-block">
        <div className="admin-block__head">
          <h2>缓存任务</h2>
          <select value={statusFilter} onChange={(event) => onFilterChange(event.target.value)}>
            <option value="">全部状态</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-table">
          {jobs.length === 0 && <div className="admin-empty">暂无任务</div>}
          {jobs.map((job) => (
            <div className="admin-row" key={job.id}>
              <div className="admin-row__main">
                <code>{job.id}</code>
                <span className={`badge badge--${job.status}`}>{job.status}</span>
                <span className="admin-row__url" title={job.sourceUrl}>
                  {job.sourceUrl}
                </span>
              </div>
              <div className="admin-row__meta">
                <span>{job.submitter}</span>
                {job.status === "failed" && <span className="admin-row__err">{job.message}</span>}
              </div>
              <div className="admin-row__actions">
                {(job.status === "failed" || job.status === "cancelled") && (
                  <button onClick={() => void act(() => api.admin.retryJob(job.id), "任务已重新排队")} title="重试">
                    <RefreshCcw size={16} /> 重试
                  </button>
                )}
                {ACTIVE_STATUSES.has(job.status) && (
                  <button onClick={() => void act(() => api.admin.cancelJob(job.id), "任务已取消")} title="取消">
                    <XCircle size={16} /> 取消
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-block">
        <div className="admin-block__head">
          <h2>用户</h2>
        </div>
        <div className="admin-table">
          {users.length === 0 && <div className="admin-empty">暂无用户</div>}
          {users.map((user) => (
            <div className="admin-row" key={user.id}>
              <div className="admin-row__main">
                {user.avatarUrl && <img className="admin-avatar" src={user.avatarUrl} alt="" />}
                <strong>{user.displayName}</strong>
                <span className="admin-row__meta">
                  {user.provider}:{user.providerUserId}
                </span>
                {user.banned && <span className="badge badge--failed">已封禁</span>}
              </div>
              <div className="admin-row__actions">
                <button
                  onClick={() => void act(() => api.admin.ban(user.id, !user.banned), user.banned ? "已解封" : "已封禁")}
                  title={user.banned ? "解封" : "封禁"}
                >
                  <Ban size={16} /> {user.banned ? "解封" : "封禁"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {usage && usage.topSubmitters.length > 0 && (
        <div className="admin-block">
          <div className="admin-block__head">
            <h2>提交者用量（Top 20）</h2>
          </div>
          <div className="admin-table">
            {usage.topSubmitters.map((row) => (
              <div className="admin-row" key={row.submitter}>
                <div className="admin-row__main">
                  <code>{row.submitter}</code>
                </div>
                <div className="admin-row__meta">
                  总 {row.total} · 完成 {row.completed} · 失败 {row.failed}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
