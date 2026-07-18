import { Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { Video } from "../api/client.js";

export function VideoCard({ video, featured = false }: { video: Video; featured?: boolean }) {
  return (
    <Link to={`/videos/${video.id}`} className={featured ? "video-card featured" : "video-card"}>
      <img src={video.posterUrl} alt="" />
      <div className="video-card__overlay">
        <span className="icon-pill">
          <Play size={16} fill="currentColor" />
        </span>
        <span>{video.hotScore}</span>
      </div>
      <div className="video-card__body">
        <h3>{video.title}</h3>
        <p>{video.description}</p>
        <div className="tag-row">
          {video.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
