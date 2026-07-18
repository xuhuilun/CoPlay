import { Copy, Gauge, Maximize, Pause, Play, RefreshCcw, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api, socketUrl, type PlayerState, type Room, type RoomMember, type Video } from "../api/client.js";
import { getGuestId, getNickname } from "../api/guest.js";

export function RoomPage() {
  const { roomId } = useParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const guestId = useMemo(() => getGuestId(), []);
  const nickname = useMemo(() => getNickname(), []);
  const [room, setRoom] = useState<Room | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [notice, setNotice] = useState("同步状态待连接");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!roomId) {
      return;
    }
    api.joinRoom(roomId, { guestId, nickname }).then((joined) => {
      setRoom(joined);
      setMembers(joined.members);
      api.video(joined.videoId).then(setVideo);
    });
  }, [guestId, nickname, roomId]);

  useEffect(() => {
    if (!roomId || !room) {
      return;
    }
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.emit("room:join", { roomId, guestId, nickname });
    socket.on("room:presence", setMembers);
    socket.on("player:sync-state", applyPlayerState);
    socket.on("player:event", (payload: { referenceState: PlayerState; action: string }) => {
      if (payload.referenceState.updatedBy === guestId) {
        return;
      }
      applyPlayerState(payload.referenceState);
      setNotice(payload.action === "sync-progress" ? "已同步对方进度" : "收到房间播放事件");
    });
    socket.on("video:switch-event", (state: PlayerState) => {
      setNotice("房主切换了视频，已准备同步");
      applyPlayerState(state);
    });
    socket.on("room:error", (payload: { message: string }) => setNotice(payload.message));

    return () => {
      socket.disconnect();
    };
  }, [guestId, nickname, room, roomId]);

  function applyPlayerState(state: PlayerState) {
    const player = videoRef.current;
    if (!player) {
      return;
    }
    if (Math.abs(player.currentTime - state.currentTime) > 0.8) {
      player.currentTime = state.currentTime;
    }
    player.playbackRate = state.playbackRate;
    if (state.paused) {
      player.pause();
    } else {
      void player.play();
    }
  }

  function emitPlayerAction(action: "play" | "pause" | "seek" | "sync-progress") {
    const player = videoRef.current;
    if (!player || !roomId) {
      return;
    }
    socketRef.current?.emit("player:action", {
      roomId,
      guestId,
      currentTime: player.currentTime,
      paused: player.paused,
      playbackRate: player.playbackRate,
      action
    });
  }

  async function copyInvite() {
    const text = `快来加入我的房间一起玩吧！ ${window.location.href}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function syncToReference() {
    socketRef.current?.emit("player:sync-request", { roomId, guestId });
    setNotice(room?.type === "couple" ? "正在同步对方进度" : "正在同步到房主");
  }

  const isHost = room?.hostGuestId === guestId;

  if (!room || !video) {
    return <div className="loading">加入房间...</div>;
  }

  return (
    <section className="room-page">
      <div className="theater">
        <video
          ref={videoRef}
          poster={video.posterUrl}
          src={video.cdnUrl}
          onPlay={() => emitPlayerAction("play")}
          onPause={() => emitPlayerAction("pause")}
          onSeeked={() => emitPlayerAction("seek")}
          controls={false}
        />
        <div className="player-controls">
          <button onClick={() => videoRef.current?.paused ? void videoRef.current.play() : videoRef.current?.pause()} title="播放/暂停">
            {videoRef.current?.paused ? <Play size={19} /> : <Pause size={19} />}
          </button>
          <button onClick={syncToReference} title={room.type === "couple" ? "同步进度" : "同步到房主"}>
            <RefreshCcw size={18} />
          </button>
          <button onClick={() => emitPlayerAction("sync-progress")} title="广播当前进度">
            <Gauge size={18} />
          </button>
          <button onClick={() => (videoRef.current!.volume = Math.max(0, videoRef.current!.volume - 0.15))} title="降低音量">
            <Volume2 size={18} />
          </button>
          <select
            aria-label="倍速"
            defaultValue="1"
            onChange={(event) => {
              if (videoRef.current) {
                videoRef.current.playbackRate = Number(event.target.value);
                emitPlayerAction("sync-progress");
              }
            }}
          >
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
          <button onClick={() => void videoRef.current?.requestFullscreen()} title="全屏">
            <Maximize size={18} />
          </button>
        </div>
      </div>

      <aside className="room-sidebar">
        <div>
          <span className="eyebrow">{room.type === "couple" ? "Couple Room" : "Screening Room"}</span>
          <h1>{video.title}</h1>
          <p>{isHost ? "你是房主，播放状态会作为参考。" : "你已加入房间，可随时同步到参考进度。"}</p>
        </div>
        <button className="primary-button wide" onClick={copyInvite} type="button">
          <Copy size={18} />
          {copied ? "已复制邀请" : "邀请好友"}
        </button>
        <div className="status-strip">{notice}</div>
        <div className="member-list">
          <h2>
            成员 {members.length}/{room.maxMembers}
          </h2>
          {members.map((member) => (
            <div key={member.guestId} className="member-row">
              <span>{member.nickname}</span>
              <strong>{member.role === "host" ? "房主" : "成员"}</strong>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
