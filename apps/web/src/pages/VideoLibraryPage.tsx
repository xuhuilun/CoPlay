import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Video } from "../api/client.js";
import { VideoCard } from "../components/VideoCard.js";

export function VideoLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    api.videos(searchParams.get("query") ?? "").then((data) => setVideos(data.items));
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
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}
