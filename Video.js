"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "./Video.css";
import debounce from "lodash.debounce";

const Video = ({ video }) => {
  const mainVideoRef = useRef(null);
  const hiddenVideoRef = useRef(null);
  const progressRef = useRef(null);
  const snapshotRef = useRef(null);

  const [snapshots, setSnapshots] = useState("");
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hoveredSecond, setHoveredSecond] = useState(0);

  // Estados para controle de volume
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const mainPlayer = useRef(null);
  const hiddenPlayer = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    mainPlayer.current = videojs(mainVideoRef.current, {
      controls: false,
      autoplay: false,
      playbackRates: [0.5, 1, 1.5, 2],
      userActions: { doubleClick: true, hotkeys: true },
      sources: [
        {
          src: video.files.HLS,
          type: "application/x-mpegURL",
          label: "HLS",
        },
      ],
    });

    hiddenPlayer.current = videojs(hiddenVideoRef.current, {
      controls: false,
      autoplay: false,
      muted: true,
    });

    mainPlayer.current.on("loadedmetadata", () => {
      const currentSource = mainPlayer.current.currentSource();
      hiddenPlayer.current.src(currentSource);
      setDuration(mainPlayer.current.duration());
    });

    mainPlayer.current.on("play", () => setIsPlaying(true));
    mainPlayer.current.on("pause", () => setIsPlaying(false));

    return () => {
      mainPlayer.current?.dispose();
      hiddenPlayer.current?.dispose();
    };
  }, [video.files]);

  const generateSnapshot = useCallback((hoveredTime) => {
    hiddenPlayer.current.currentTime(hoveredTime);
    hiddenPlayer.current.one("seeked", () => {
      const videoElement = hiddenPlayer.current.el().querySelector("video");
      if (videoElement) {
        const canvas = document.createElement("canvas");
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(videoElement, 0, 0);
        const previewWidth = 160;
        const scale = previewWidth / canvas.width;
        const previewCanvas = document.createElement("canvas");
        previewCanvas.width = previewWidth;
        previewCanvas.height = canvas.height * scale;
        const previewCtx = previewCanvas.getContext("2d");
        previewCtx.drawImage(
          canvas,
          0,
          0,
          previewCanvas.width,
          previewCanvas.height,
        );
        setSnapshots(previewCanvas.toDataURL());
      }
    });
  }, []);

  const debouncedGenerateSnapshot = useCallback(
    debounce(generateSnapshot, 100),
    [generateSnapshot],
  );

  const handleMouseMove = useCallback(
    (e) => {
      const rect = e.target.getBoundingClientRect();
      const hoveredTime = ((e.clientX - rect.left) / rect.width) * duration;
      setHoveredSecond(hoveredTime);

      if (snapshotRef.current) {
        const progressWidth = e.target.offsetWidth;
        const previewPosition = (hoveredTime / duration) * progressWidth;
        snapshotRef.current.style.left = `${previewPosition - 80}px`;
      }

      debouncedGenerateSnapshot(hoveredTime);
    },
    [duration, debouncedGenerateSnapshot],
  );

  const updateProgress = useCallback(() => {
    if (progressRef.current && mainPlayer.current) {
      const currentTime = mainPlayer.current.currentTime();
      progressRef.current.value = currentTime;
      progressRef.current.style.setProperty(
        "--seek-before-width",
        `${(currentTime / duration) * 100}%`,
      );
    }
  }, [duration]);

  const handlePlaybackRateChange = useCallback((rate) => {
    mainPlayer.current.playbackRate(rate);
    setPlaybackRate(rate);
  }, []);

  // Função para alternar entre mudo e com som
  const toggleMute = () => {
    const newMuted = !isMuted;
    if (mainPlayer.current) {
      mainPlayer.current.muted(newMuted);
    }
    setIsMuted(newMuted);
  };

  // Função para alterar o volume via slider
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (mainPlayer.current) {
      mainPlayer.current.volume(newVolume);
    }
    // Se aumentar o volume, desativa o mudo
    if (newVolume > 0 && isMuted) {
      mainPlayer.current.muted(false);
      setIsMuted(false);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        updateProgress();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateProgress]);

  return (
    <div className={`video-container h-1/2`}>
      <div data-vjs-player>
        <video
          ref={mainVideoRef}
          className="video-js vjs-theme-modern"
          onClick={() => mainPlayer.current[isPlaying ? "pause" : "play"]()}
        />
        <div className="custom-controls">
          <div className="controls-overlay" />

          <div className="controls-wrapper">
            <button
              className="control-button play-pause"
              onClick={() =>
                isPlaying
                  ? mainPlayer.current.pause()
                  : mainPlayer.current.play()
              }
            >
              {isPlaying ? (
                <svg className="icon" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M14,19H18V5H14M6,19H10V5H6V19Z"
                  />
                </svg>
              ) : (
                <svg className="icon" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M8,5.14V19.14L19,12.14L8,5.14Z"
                  />
                </svg>
              )}
            </button>

            <div className="time-display">
              {formatTime(mainPlayer.current?.currentTime() || 0)}
            </div>

            <div
              className="progress-container"
              style={{ position: "relative" }}
              onMouseLeave={() => {
                setSnapshots("");
                setHoveredSecond(0);
              }}
            >
              <input
                type="range"
                className="progress-bar"
                ref={progressRef}
                min="0"
                max={duration}
                step="any"
                onChange={(e) => mainPlayer.current.currentTime(e.target.value)}
                onMouseMove={handleMouseMove}
              />
              {snapshots && (
                <div
                  className="snapshot-preview"
                  ref={snapshotRef}
                  style={{ pointerEvents: "none" }}
                >
                  <img src={snapshots} alt="Preview" />
                  <span>{formatTime(hoveredSecond)}</span>
                </div>
              )}
            </div>

            <div className="time-display">{formatTime(duration)}</div>

            <div className="right-controls">
              {/* Controle de Volume */}
              <div className="volume-control">
                <button
                  className="control-button volume-button"
                  onClick={toggleMute}
                >
                  {isMuted || volume === 0 ? (
                    <svg className="icon" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M16.5,12c0-1.77-0.77-3.29-2-4.31v8.62C15.73,15.29,16.5,13.77,16.5,12z M19,12c0,3.31-2.69,6-6,6
                           c-1.42,0-2.74-0.5-3.77-1.34l1.42-1.42C10.17,15.86,11.2,16.5,12,16.5c2.48,0,4.5-2.02,4.5-4.5S14.48,7.5,12,7.5
                           c-0.8,0-1.83,0.64-2.85,1.29l-1.42-1.42C9.26,7,10.58,6.5,12,6.5C15.31,6.5,18,9.19,18,12z M3,9v6h4l5,5V4L7,9H3z 
                           M21,3L3,21l1.41,1.41L22.41,4.41L21,3z"
                      />
                    </svg>
                  ) : (
                    <svg className="icon" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M3,9v6h4l5,5V4L7,9H3z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  className="volume-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                />
              </div>

              {/* Controle de Velocidade */}
              <div className="speed-control dropdown">
                <button className="control-button">
                  {playbackRate}x
                  <svg className="chevron" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M7,10L12,15L17,10H7Z" />
                  </svg>
                </button>
                <div className="dropdown-menu">
                  {[0.5, 1, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      className={rate === playbackRate ? "active" : ""}
                      onClick={() => handlePlaybackRateChange(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <video
        ref={hiddenVideoRef}
        className="video-js hidden-video hidden absolute"
        style={{ display: "none" }}
      />
    </div>
  );
};

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s]
    .map((v) => (v < 10 ? "0" + v : v))
    .filter((v, i) => v !== "00" || i > 0)
    .join(":");
}

export default Video;