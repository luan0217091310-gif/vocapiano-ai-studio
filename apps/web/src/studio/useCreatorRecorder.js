import { useEffect, useRef, useState } from "react";

function outputSize(ratio) {
  return ratio === "portrait" ? [1080, 1920] : [1920, 1080];
}

function filename(lesson, ratio) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `vocaverse-${lesson || "lesson"}-${ratio === "portrait" ? "9x16" : "16x9"}-${stamp}.webm`;
}

export function useCreatorRecorder(ratio, lesson) {
  const active = useRef(null);
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const supported = Boolean(
    navigator.mediaDevices?.getDisplayMedia && window.MediaRecorder,
  );

  const stop = () => {
    const session = active.current;
    if (!session || session.stopping) return;
    session.stopping = true;
    cancelAnimationFrame(session.frame);
    if (session.recorder.state !== "inactive") session.recorder.stop();
    else session.finish();
  };

  const start = async () => {
    setError("");
    if (!supported) {
      setError(
        "Trình duyệt này chưa hỗ trợ ghi hình. Hãy dùng Chrome hoặc Edge.",
      );
      return;
    }
    setPreparing(true);
    let input;
    let output;
    let session;
    try {
      input = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });
      const track = input.getVideoTracks()[0];
      if (!track)
        throw new Error("Không nhận được hình ảnh từ tab được chia sẻ.");
      const surface = track.getSettings().displaySurface;
      if (surface && surface !== "browser")
        throw new Error(
          "Hãy chọn chia sẻ tab trình duyệt hiện tại để cắt đúng khung Creator.",
        );

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = input;
      await video.play();
      const [width, height] = outputSize(ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context || !canvas.captureStream)
        throw new Error("Không thể tạo luồng video trong trình duyệt này.");

      output = canvas.captureStream(30);
      for (const audioTrack of input.getAudioTracks())
        output.addTrack(audioTrack);
      const types = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType = types.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(
        output,
        mimeType ? { mimeType } : undefined,
      );
      const chunks = [];
      session = {
        input,
        output,
        video,
        recorder,
        chunks,
        frame: 0,
        stopping: false,
      };
      session.finish = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "video/webm",
        });
        if (blob.size) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename(lesson, ratio);
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else setError("Video trống, hãy ghi lại và thử thêm lần nữa.");
        input.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        output.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        video.srcObject = null;
        active.current = null;
        setRecording(false);
        setPreparing(false);
      };
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = session.finish;
      recorder.onerror = () => {
        setError(
          "Ghi hình bị gián đoạn. Hãy thử lại và giữ nguyên tab chia sẻ.",
        );
        stop();
      };
      active.current = session;

      let lastFrame = 0;
      const draw = (now) => {
        if (session.stopping) return;
        if (now - lastFrame >= 1000 / 30 && video.readyState >= 2) {
          lastFrame = now;
          const stage = document.querySelector(".creator-canvas");
          if (stage) {
            const rect = stage.getBoundingClientRect();
            const scaleX = video.videoWidth / window.innerWidth;
            const scaleY = video.videoHeight / window.innerHeight;
            context.fillStyle = "#0B0E14";
            context.fillRect(0, 0, width, height);
            context.drawImage(
              video,
              rect.left * scaleX,
              rect.top * scaleY,
              rect.width * scaleX,
              rect.height * scaleY,
              0,
              0,
              width,
              height,
            );
          }
        }
        session.frame = requestAnimationFrame(draw);
      };
      session.frame = requestAnimationFrame(draw);
      track.addEventListener("ended", stop, { once: true });
      recorder.start(1000);
      active.current = session;
      setSeconds(0);
      setPreparing(false);
      setRecording(true);
    } catch (cause) {
      if (session) {
        cancelAnimationFrame(session.frame);
        active.current = null;
      }
      output?.getTracks().forEach((track) => track.stop());
      input?.getTracks().forEach((track) => track.stop());
      setError(
        cause.name === "NotAllowedError"
          ? "Chưa có quyền chia sẻ tab. Cho phép chia sẻ tab hiện tại để ghi hình."
          : cause.message || "Không thể bắt đầu ghi video.",
      );
      setPreparing(false);
    }
  };

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => () => stop(), []);

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return { recording, preparing, seconds: time, error, supported, start, stop };
}
