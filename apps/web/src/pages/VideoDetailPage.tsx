import { DoorOpen, Heart, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type RoomType, type Video } from "../api/client.js";
import { getGuestId, getNickname } from "../api/guest.js";

export function VideoDetailPage() {
  const { videoId } = useParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [roomType, setRoomType] = useState<RoomType>("screening");
  const [maxMembers, setMaxMembers] = useState(8);
  const navigate = useNavigate();

  useEffect(() => {
    if (videoId) {
      api.video(videoId).then(setVideo);
    }
  }, [videoId]);

  async function createRoom() {
    if (!video) {
      return;
    }
    const room = await api.createRoom({
      videoId: video.id,
      type: roomType,
      ownerGuestId: getGuestId(),
      ownerNickname: getNickname(),
      maxMembers
    });
    navigate(`/rooms/${room.id}`);
  }

  if (!video) {
    return <div className="loading">加载视频...</div>;
  }

  return (
    <section className="detail-page">
      <div className="detail-poster">
        <img src={video.posterUrl} alt="" />
      </div>
      <div className="detail-copy">
        <span className="eyebrow">Video Detail</span>
        <h1>{video.title}</h1>
        <p>{video.description}</p>
        <div className="tag-row">
          {video.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <div className="room-config">
          <button
            className={roomType === "couple" ? "segmented active" : "segmented"}
            onClick={() => setRoomType("couple")}
            type="button"
          >
            <Heart size={18} />
            情侣房间
          </button>
          <button
            className={roomType === "screening" ? "segmented active" : "segmented"}
            onClick={() => setRoomType("screening")}
            type="button"
          >
            <Users size={18} />
            放映厅
          </button>
        </div>

        {roomType === "screening" && (
          <label className="capacity-control">
            人数上限
            <input
              type="number"
              min={2}
              max={100}
              value={maxMembers}
              onChange={(event) => setMaxMembers(Number(event.target.value))}
            />
          </label>
        )}

        <button className="primary-button wide" onClick={createRoom} type="button">
          <DoorOpen size={18} />
          创建房间
        </button>
      </div>
    </section>
  );
}
