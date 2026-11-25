import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Pause, Play, RotateCcw } from "lucide-react";
import { track } from "../api/client.js";
import { readProductState, updateProductState } from "../productStore.js";

// Blender (Z lên) → glTF/three (Y lên): (x, y, z) → (x, z, -y).
const VIEWS = {
  "3/4": { pos: [0.13, 0.36, 0.42], target: [0.05, 0.0, -0.02] },
  "Từ trên": { pos: [0.047, 0.62, -0.02], target: [0.047, 0.0, -0.021] },
  "Bên cạnh": { pos: [0.42, 0.16, -0.02], target: [0.05, 0.02, -0.03] },
};

/** Trình xem 3D tương tác: tay Minh An + phím, hoạt ảnh nướng sẵn đồng bộ theo tiếng. */
export default function Hand3DViewer({ modelSrc, audioSrc }) {
  const mountRef = useRef(null);
  const audioRef = useRef(null);
  const stateRef = useRef({});
  const [status, setStatus] = useState("loading");
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [view, setView] = useState("3/4");

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = Math.round((width * 9) / 16);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#2b2f38");
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.01, 10);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.12;
    controls.maxDistance = 1.4;
    scene.add(new THREE.HemisphereLight("#fff6ee", "#3a3d48", 1.6));
    const key = new THREE.DirectionalLight("#ffffff", 2.4);
    key.position.set(-0.3, 0.9, 0.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -0.4,
      right: 0.4,
      top: 0.4,
      bottom: -0.4,
    });
    scene.add(key);
    const rim = new THREE.DirectionalLight("#ffd9c4", 0.8);
    rim.position.set(0.4, 0.3, -0.6);
    scene.add(rim);

    let mixer = null;
    let frame = 0;
    const clock = new THREE.Clock();
    new GLTFLoader().load(
      modelSrc,
      (gltf) => {
        // Chất liệu cel-shading của Blender không xuất sang glTF → dựng lại bằng toon trên web.
        const ramp = new THREE.DataTexture(
          new Uint8Array([90, 170, 255]),
          3,
          1,
          THREE.RedFormat,
        );
        ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
        ramp.needsUpdate = true;
        const toon = {
          Mat_Anime_Skin: "#f2c4a8",
          Mat_Anime_Nail: "#f6d5d0",
          Mat_Anime_Sleeve: "#2b3f7a",
        };
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const next = mats.map((m) =>
            toon[m.name]
              ? new THREE.MeshToonMaterial({
                  name: m.name,
                  color: toon[m.name],
                  gradientMap: ramp,
                })
              : m,
          );
          o.material = Array.isArray(o.material) ? next : next[0];
        });
        scene.add(gltf.scene);
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          // Mỗi vật thể (xương tay, từng phím) là một hoạt ảnh riêng: phát tất cả cùng lúc.
          for (const clip of gltf.animations) mixer.clipAction(clip).play();
          mixer.setTime(0);
        }
        setStatus("ready");
      },
      undefined,
      () => setStatus("error"),
    );

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const audio = audioRef.current;
      if (mixer && audio) {
        // Đồng hồ là âm thanh: hình luôn bám tiếng, kể cả khi đổi tốc độ hay tua.
        mixer.setTime(audio.currentTime);
      } else if (mixer) {
        mixer.update(clock.getDelta());
      }
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = Math.round((w * 9) / 16);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    stateRef.current = { camera, controls };
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [modelSrc]);

  useEffect(() => {
    const { camera, controls } = stateRef.current;
    if (!camera) return;
    const v = VIEWS[view];
    camera.position.set(...v.pos);
    controls.target.set(...v.target);
    controls.update();
  }, [view, status]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      if (!readProductState().viewed3d) updateProductState({ viewed3d: true });
      track("demo3d.play", { path: location.pathname });
    } else a.pause();
  };

  return (
    <div className="hand3d">
      <div
        ref={mountRef}
        className="hand3d-canvas"
        aria-label="Cảnh 3D tay Minh An trên đàn piano"
      >
        {status === "loading" && (
          <span className="hand3d-msg">Đang tải mô hình 3D…</span>
        )}
        {status === "error" && (
          <span className="hand3d-msg">Không tải được mô hình 3D.</span>
        )}
      </div>
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div className="hand3d-bar">
        <button
          type="button"
          className="hand3d-play"
          onClick={toggle}
          disabled={status !== "ready"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
          {playing ? "Tạm dừng" : "Phát"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (audioRef.current) audioRef.current.currentTime = 0;
          }}
          aria-label="Về đầu bài"
        >
          <RotateCcw size={15} />
        </button>
        <span className="hand3d-sep" />
        {Object.keys(VIEWS).map((v) => (
          <button
            key={v}
            type="button"
            className={view === v ? "active" : ""}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
        <span className="hand3d-sep" />
        {[0.5, 0.75, 1].map((r) => (
          <button
            key={r}
            type="button"
            className={rate === r ? "active" : ""}
            onClick={() => setRate(r)}
          >
            {r}×
          </button>
        ))}
      </div>
      <p className="hand3d-hint">
        Kéo chuột để xoay · cuộn để phóng to · chuột phải để dời khung nhìn.
      </p>
    </div>
  );
}
