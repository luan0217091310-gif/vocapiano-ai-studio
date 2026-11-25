import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export const CHARACTERS = [
  { id: "minh_an_piano", label: "Minh An · ngồi đàn piano" },
  { id: "gia_phong_sao_truc", label: "Gia Phong · thổi sáo trúc" },
  { id: "minh_an_apose_360", label: "Minh An · đứng xoay 360°" },
];

/** Xem nhân vật toàn thân (GLB do Anti dựng), tự căn khung theo kích thước mô hình. */
export default function CharacterViewer() {
  const mountRef = useRef(null);
  const [pick, setPick] = useState(CHARACTERS[0].id);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = Math.round((width * 9) / 16);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#2b2f38");
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight("#fff6ee", "#3a3d48", 2.0));
    const sun = new THREE.DirectionalLight("#ffffff", 2.2);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const rim = new THREE.DirectionalLight("#ffd9c4", 0.8);
    rim.position.set(-2, 2, -3);
    scene.add(rim);

    setStatus("loading");
    let frame = 0;
    let mixer = null;
    const clock = new THREE.Clock();
    new GLTFLoader().load(
      `/models/characters/${pick}.glb`,
      (gltf) => {
        scene.add(gltf.scene);
        // Căn khung theo nhân vật + nhạc cụ, bỏ qua mặt sàn phẳng lớn (nếu không camera lùi quá xa).
        const box = new THREE.Box3();
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          const b = new THREE.Box3().setFromObject(o);
          const s = b.getSize(new THREE.Vector3());
          const flat = s.y < 0.02 && Math.max(s.x, s.z) > 2;
          if (!flat) box.union(b);
        });
        if (box.isEmpty()) box.setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const dist = Math.max(size.x, size.y, size.z) * 1.25;
        camera.position.set(
          center.x + dist * 0.55,
          center.y + dist * 0.35,
          center.z + dist * 0.9,
        );
        controls.target.copy(center);
        controls.minDistance = dist * 0.15;
        controls.maxDistance = dist * 4;
        controls.update();
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          for (const clip of gltf.animations) mixer.clipAction(clip).play();
        }
        setStatus("ready");
      },
      undefined,
      () => setStatus("error"),
    );

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (mixer) mixer.update(clock.getDelta());
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
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [pick]);

  return (
    <div className="hand3d">
      <div className="hand3d-bar">
        {CHARACTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={pick === c.id ? "active" : ""}
            onClick={() => setPick(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div ref={mountRef} className="hand3d-canvas" aria-label="Nhân vật 3D">
        {status === "loading" && (
          <span className="hand3d-msg">Đang tải nhân vật (~22 MB)…</span>
        )}
        {status === "error" && (
          <span className="hand3d-msg">Không tải được nhân vật 3D.</span>
        )}
      </div>
      <p className="hand3d-hint">
        Kéo chuột để xoay · cuộn để phóng to · chuột phải để dời khung nhìn.
      </p>
    </div>
  );
}
