import { ArrowRight, Loader2, Search, UploadCloud } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type CacheJob, type Video } from "../api/client.js";
import { VideoCard } from "../components/VideoCard.js";

export function HomePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [job, setJob] = useState<CacheJob | null>(null);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.hotVideos().then((data) => setVideos(data.items));
  }, []);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") {
      return;
    }
    const timer = window.setInterval(async () => {
      const next = await api.cacheJob(job.id);
      setJob(next);
    }, 900);
    return () => window.clearInterval(timer);
  }, [job]);

  async function submitCacheJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = await api.createCacheJob(sourceUrl);
    setJob(next);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(`/library?query=${encodeURIComponent(search)}`);
  }

  return (
    <section className="home">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">bilisync.top ready</span>
          <h1>把异地观影变成同一个控制台。</h1>
          <p>
            缓存 B 站视频到 CDN，创建情侣房间或放映厅，用弱同步和一键对齐保留观看自由。
          </p>
          <form className="searchbar" onSubmit={submitSearch}>
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索视频库"
            />
            <button type="submit">搜索</button>
          </form>
        </div>

        <form className="cache-console" onSubmit={submitCacheJob}>
          <div>
            <span className="eyebrow">Bilibili Cache</span>
            <h2>提交缓存任务</h2>
          </div>
          <input
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="粘贴 B 站视频链接"
            type="url"
            required
          />
          <button className="primary-button" type="submit">
            <UploadCloud size={18} />
            缓存到 CDN
          </button>
          {job && (
            <div className="job-meter">
              <div className="job-meter__line">
                <span>{job.message}</span>
                <strong>{job.progress}%</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${job.progress}%` }} />
              </div>
              {job.status === "completed" && job.videoId && (
                <Link to={`/videos/${job.videoId}`}>
                  进入视频详情 <ArrowRight size={15} />
                </Link>
              )}
              {job.status !== "completed" && <Loader2 className="spin" size={18} />}
            </div>
          )}
        </form>
      </div>

      <div className="section-heading">
        <div>
          <span className="eyebrow">Hot Library</span>
          <h2>热门视频</h2>
        </div>
        <Link to="/library">查看全部</Link>
      </div>
      <div className="video-grid">
        {videos.map((video, index) => (
          <VideoCard key={video.id} video={video} featured={index === 0} />
        ))}
      </div>
    </section>
  );
}
