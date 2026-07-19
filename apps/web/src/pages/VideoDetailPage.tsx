import { DoorOpen, Heart, Loader2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type RoomType, type Video } from "../api/client.js";
import { getGuestId, getNickname } from "../api/guest.js";
import { PageState } from "../components/PageState.js";

export function VideoDetailPage() {
  const { videoId } = useParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [videoError, setVideoError] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomType, setRoomType] = useState<RoomType>("screening");
  const [maxMembers, setMaxMembers] = useState(8);
  const navigate = useNavigate();

  useEffect(() => {
    if (!videoId) {
      setVideoError("视频地址无效");
      setIsLoadingVideo(false);
      return;
    }
    let ignore = false;
    setIsLoadingVideo(true);
    setVideoError("");
    api.video(videoId)
      .then((next) => {
        if (!ignore) {
          setVideo(next);
        }
      })
      .catch(() => {
        if (!ignore) {
          setVideoError("视频详情暂时无法加载");
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingVideo(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [videoId]);

  async function createRoom() {
    if (!video) {
      return;
    }
    setIsCreatingRoom(true);
    setCreateError("");
    try {
      const room = await api.createRoom({
        videoId: video.id,
        type: roomType,
        ownerGuestId: getGuestId(),
        ownerNickname: getNickname(),
        maxMembers
      });
      navigate(`/rooms/${room.id}`);
    } catch {
      setCreateError("房间创建失败，请稍后重试");
    } finally {
      setIsCreatingRoom(false);
    }
  }

  if (isLoadingVideo) {
    return <PageState tone="loading" title="正在加载视频详情" />;
  }

  if (videoError) {
    return <PageState tone="error" title={videoError} />;
  }

  if (!video) {
    return <PageState tone="empty" title="视频不存在" />;
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

        {createError && <div className="inline-alert">{createError}</div>}

        <button className="primary-button wide" onClick={createRoom} type="button" disabled={isCreatingRoom}>
          {isCreatingRoom ? <Loader2 className="spin" size={18} /> : <DoorOpen size={18} />}
          {isCreatingRoom ? "创建中" : "创建房间"}
        </button>
      </div>
    </section>
  );
}
