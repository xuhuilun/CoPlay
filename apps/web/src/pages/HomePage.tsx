import { ArrowRight, Loader2, Search, UploadCloud } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketUrl, type CacheJob, type Video } from "../api/client.js";
import { PageState } from "../components/PageState.js";
import { VideoCard } from "../components/VideoCard.js";

export function HomePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [videoError, setVideoError] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [job, setJob] = useState<CacheJob | null>(null);
  const [jobError, setJobError] = useState("");
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;
    setIsLoadingVideos(true);
    setVideoError("");
    api.hotVideos()
      .then((data) => {
        if (!ignore) {
          setVideos(data.items);
        }
      })
      .catch(() => {
        if (!ignore) {
          setVideoError("热门视频暂时无法加载");
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingVideos(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const next = await api.cacheJob(job.id);
        setJob(next);
      } catch {
        setJobError("缓存进度暂时无法刷新");
      }
    }, 900);
    return () => window.clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") {
      return;
    }
    const socket = io(socketUrl, { reconnection: true });
    socket.on("connect", () => {
      socket.emit("cache-job:subscribe", { jobId: job.id });
    });
    socket.on("cache-job:update", (next: CacheJob) => {
      if (next.id === job.id) {
        setJob(next);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [job?.id, job?.status]);

  async function submitCacheJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingJob(true);
    setJobError("");
    try {
      const next = await api.createCacheJob(sourceUrl);
      setJob(next);
    } catch {
      setJobError("缓存任务提交失败，请稍后重试");
    } finally {
      setIsSubmittingJob(false);
    }
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
          <h1>有人陪伴就是幸福</h1>
          <p>
            异地观影，远程同步，尽在CoPlay！
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
          <button className="primary-button" type="submit" disabled={isSubmittingJob}>
            {isSubmittingJob ? <Loader2 className="spin" size={18} /> : <UploadCloud size={18} />}
            {isSubmittingJob ? "提交中" : "缓存到 CDN"}
          </button>
          {jobError && <div className="inline-alert">{jobError}</div>}
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
        {isLoadingVideos && <PageState tone="loading" title="正在加载热门视频" />}
        {!isLoadingVideos && videoError && <PageState tone="error" title={videoError} />}
        {!isLoadingVideos && !videoError && videos.length === 0 && (
          <PageState tone="empty" title="暂无热门视频" />
        )}
        {!isLoadingVideos &&
          !videoError &&
          videos.map((video, index) => (
            <VideoCard key={video.id} video={video} featured={index === 0} />
          ))}
      </div>
    </section>
  );
}
