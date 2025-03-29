import { useState, useEffect, useRef } from "react";
import { decode } from "@msgpack/msgpack";

export const usePlayer = (sessionId) => {
  const [events, setEvents] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const frameRef = useRef();
  const startTimeRef = useRef();

  // getting seesion data
  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch(
        `http://localhost:3001/sessions/${sessionId}`
      );
      const buffer = await response.arrayBuffer();
      const data = decode(new Uint8Array(buffer));
      setEvents(data);
    };
    fetchData();
  }, [sessionId]);

  // PlayBack logic
  const play = () => {
    setIsPlaying(true);
    startTimeRef.current = performance.now() - currentTime * 1000;
    frameRef.current = requestAnimationFrame(animate);
  };

  const pause = () => {
    setIsPlaying(false);
    cancelAnimationFrame(frameRef.current);
  };

  const seek = (seconds) => {
    const newTime = Math.max(0, currentTime + seconds);
    setCurrentTime(newTime);
  };

  const animate = () => {
    if (!isPlaying) return;

    const elapsed = (performance.now() - startTimeRef.current) * playbackSpeed;
    setCurrentTime(elapsed / 1000);

    if (elapsed < getTotalDuration()) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      pause();
    }
  };

  const getTotalDuration = () => {
    return events.length > 0
      ? events[events.length - 1].timestamp - events[0].timestamp
      : 0;
  };

  return {
    events,
    isPlaying,
    currentTime,
    playbackSpeed,
    play,
    pause,
    seek,
    setPlaybackSpeed,
  };
};
