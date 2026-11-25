import { useSyncExternalStore, useEffect, useRef } from "react";
export function useStudio(controller) {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
}
export function useAnimation(callback) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    let frame;
    const tick = () => {
      ref.current();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
}
