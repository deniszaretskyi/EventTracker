import { Slider, Button, Select } from "@mui/material";
import { formatTime } from "../../utils/helpers";

export const Controls = ({
  isPlaying,
  duration,
  currentTime,
  playbackSpeed,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
}) => (
  <div className="controls-container">
    <div className="time-controls">
      <Button variant="contained" onClick={isPlaying ? onPause : onPlay}>
        {isPlaying ? "⏸ Pause" : "▶ Play"}
      </Button>

      <Slider
        value={currentTime}
        min={0}
        max={duration}
        step={0.1}
        onChange={(_, value) => onSeek(value - currentTime)}
        valueLabelDisplay="auto"
        valueLabelFormat={formatTime}
      />

      <div className="time-display">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>

    <div className="speed-controls">
      <Select
        value={playbackSpeed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        native
        inputProps={{
          name: "playback-speed",
          id: "playback-speed-select",
        }}
      >
        <option value={0.5}>0.5x</option>
        <option value={1}>1x</option>
        <option value={1.5}>1.5x</option>
        <option value={2}>2x</option>
      </Select>

      <Button onClick={() => onSeek(-10)}>⏪ 10s</Button>
      <Button onClick={() => onSeek(10)}>⏩ 10s</Button>
    </div>
  </div>
);
