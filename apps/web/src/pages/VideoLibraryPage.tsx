import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Video } from "../api/client.js";
import { PageState } from "../components/PageState.js";
import { VideoCard } from "../components/VideoCard.js";

export function VideoLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError("");
    api.videos(searchParams.get("query") ?? "")
      .then((data) => {
        if (!ignore) {
          setVideos(data.items);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("视频库暂时无法加载");
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [searchParams]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchParams(query ? { query } : {});
  }

  return (
    <section className="library-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Cached CDN Library</span>
          <h1>视频库</h1>
        </div>
        <form className="compact-search" onSubmit={submit}>
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" />
        </form>
      </div>
      <div className="video-grid">
        {isLoading && <PageState tone="loading" title="正在加载视频库" />}
        {!isLoading && error && <PageState tone="error" title={error} />}
        {!isLoading && !error && videos.length === 0 && <PageState tone="empty" title="没有找到匹配视频" />}
        {!isLoading &&
          !error &&
          videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
      </div>
    </section>
  );
}
