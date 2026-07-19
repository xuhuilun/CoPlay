import { Clapperboard, Copy, Gauge, Maximize, Pause, Play, RefreshCcw, Save, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import {
  api,
  socketUrl,
  type PlayerState,
  type Room,
  type RoomMember,
  type RoomPresence,
  type Video
} from "../api/client.js";
import { getGuestId, getNickname, setNickname } from "../api/guest.js";

export function RoomPage() {
  const { roomId } = useParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  const pendingPlayerStateRef = useRef<PlayerState | null>(null);
  const guestId = useMemo(() => getGuestId(), []);
  const initialNickname = useMemo(() => getNickname(), []);
  const [nickname, setNicknameState] = useState(initialNickname);
  const [nicknameDraft, setNicknameDraft] = useState(initialNickname);
  const [room, setRoom] = useState<Room | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [libraryVideos, setLibraryVideos] = useState<Video[]>([]);
  const [switchVideoId, setSwitchVideoId] = useState("");
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [onlineGuestIds, setOnlineGuestIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("同步状态待连接");
  const [copied, setCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

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
    currentVideoIdRef.current = video?.id ?? null;
  }, [video]);

  useEffect(() => {
    api.videos().then((data) => setLibraryVideos(data.items));
  }, []);

  useEffect(() => {
    if (!roomId || !room) {
      return;
    }
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.emit("room:join", { roomId, guestId, nickname });
    socket.on("room:presence", (payload: RoomPresence | RoomMember[]) => {
      if (Array.isArray(payload)) {
        setMembers(payload);
        setOnlineGuestIds(payload.map((member) => member.guestId));
        return;
      }
      setMembers(payload.members);
      setOnlineGuestIds(payload.onlineGuestIds);
    });
    socket.on("player:sync-state", (state: PlayerState) => {
      void handleIncomingPlayerState(state);
    });
    socket.on("player:event", (payload: { referenceState: PlayerState; action: string }) => {
      if (payload.referenceState.updatedBy === guestId) {
        return;
      }
      void handleIncomingPlayerState(payload.referenceState);
      setNotice(payload.action === "sync-progress" ? "已同步对方进度" : "收到房间播放事件");
    });
    socket.on("video:switch-event", (state: PlayerState) => {
      void handleIncomingPlayerState(state);
      setNotice("房主切换了视频，已加载新片源");
    });
    socket.on("room:error", (payload: { message: string }) => setNotice(payload.message));

    return () => {
      socket.disconnect();
    };
  }, [guestId, nickname, room?.id, roomId]);

  async function handleIncomingPlayerState(state: PlayerState) {
    if (state.videoId !== currentVideoIdRef.current) {
      pendingPlayerStateRef.current = state;
      const nextVideo = await api.video(state.videoId);
      setVideo(nextVideo);
      setRoom((current) => current ? { ...current, videoId: state.videoId, playerState: state } : current);
      return;
    }
    applyPlayerState(state);
  }

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
    setIsPaused(state.paused);
    setCurrentTime(state.currentTime);
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

  function switchRoomVideo() {
    if (!roomId || !switchVideoId || switchVideoId === video?.id) {
      return;
    }
    socketRef.current?.emit("video:switch", { roomId, guestId, videoId: switchVideoId });
  }

  async function saveNickname() {
    const next = setNickname(nicknameDraft);
    setNicknameState(next);
    setNicknameDraft(next);
    if (roomId) {
      const joined = await api.joinRoom(roomId, { guestId, nickname: next });
      setMembers(joined.members);
      socketRef.current?.emit("room:join", { roomId, guestId, nickname: next });
    }
  }

  function applyPendingPlayerState() {
    const pending = pendingPlayerStateRef.current;
    if (!pending) {
      return;
    }
    pendingPlayerStateRef.current = null;
    applyPlayerState(pending);
  }

  function togglePlayback() {
    const player = videoRef.current;
    if (!player) {
      return;
    }
    if (player.paused) {
      void player.play();
    } else {
      player.pause();
    }
  }

  function seekTo(value: number) {
    const player = videoRef.current;
    if (!player) {
      return;
    }
    player.currentTime = value;
    setCurrentTime(value);
    emitPlayerAction("seek");
  }

  function setPlayerVolume(value: number) {
    const player = videoRef.current;
    if (!player) {
      return;
    }
    player.volume = value;
    setVolume(value);
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
          onPlay={() => {
            setIsPaused(false);
            emitPlayerAction("play");
          }}
          onPause={() => {
            setIsPaused(true);
            emitPlayerAction("pause");
          }}
          onSeeked={() => emitPlayerAction("seek")}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration || 0);
            setVolume(event.currentTarget.volume);
            applyPendingPlayerState();
          }}
          controls={false}
        />
        <div className="player-controls">
          <div className="timeline-row">
            <span>{formatTime(currentTime)}</span>
            <input
              aria-label="进度"
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || currentTime)}
              onChange={(event) => seekTo(Number(event.target.value))}
            />
            <span>{formatTime(duration)}</span>
          </div>
          <div className="control-row">
            <button onClick={togglePlayback} title="播放/暂停">
              {isPaused ? <Play size={19} /> : <Pause size={19} />}
            </button>
            <button onClick={syncToReference} title={room.type === "couple" ? "同步进度" : "同步到房主"}>
              <RefreshCcw size={18} />
            </button>
            <button onClick={() => emitPlayerAction("sync-progress")} title="广播当前进度">
              <Gauge size={18} />
            </button>
            <label className="volume-control">
              <Volume2 size={18} />
              <input
                aria-label="音量"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => setPlayerVolume(Number(event.target.value))}
              />
            </label>
            <select aria-label="清晰度" defaultValue="auto">
              <option value="auto">Auto</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
            </select>
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
        <div className="nickname-editor">
          <input
            aria-label="昵称"
            value={nicknameDraft}
            onChange={(event) => setNicknameDraft(event.target.value)}
            maxLength={24}
          />
          <button onClick={saveNickname} type="button" title="保存昵称">
            <Save size={18} />
          </button>
        </div>
        {isHost && (
          <div className="video-switcher">
            <label htmlFor="switch-video">切换影片</label>
            <div>
              <select
                id="switch-video"
                value={switchVideoId}
                onChange={(event) => setSwitchVideoId(event.target.value)}
              >
                <option value="">选择视频库影片</option>
                {libraryVideos.map((item) => (
                  <option key={item.id} value={item.id} disabled={item.id === video.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <button onClick={switchRoomVideo} type="button" title="切换影片">
                <Clapperboard size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="status-strip">{notice}</div>
        <div className="member-list">
          <h2>
            成员 {members.length}/{room.maxMembers}
          </h2>
          {members.map((member) => (
            <div key={member.guestId} className="member-row">
              <span>
                <i className={onlineGuestIds.includes(member.guestId) ? "presence-dot online" : "presence-dot"} />
                {member.nickname}
              </span>
              <strong>{member.role === "host" ? "房主" : "成员"}</strong>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
