import { useRef, useState } from "react";
import { Recorder } from "../recorder/useRecorder";

export default function RecorderButton() {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef(null);

  const handleClick = () => {
    if (!isRecording) {
      // Start
      const rec = new Recorder();
      rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
      console.log("Recording started");
    } else {
      // Stop
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      setIsRecording(false);
      console.log("Recording stopped");
    }
  };

  return (
    <button onClick={handleClick}>
      {isRecording ? "Stop Recording" : "Start Recording"}
    </button>
  );
}
