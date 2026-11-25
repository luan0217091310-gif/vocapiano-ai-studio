// Build gói tĩnh + dữ liệu học liệu công khai (Public Domain & tự soạn) cho Cloudflare Workers (`apps/web/dist-cf`).
// KHÔNG đóng gói kho bài test có bản quyền (`content/_local_test/`).
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildImportedArrangements } from "./api/modules/importer/importer.mjs";

const web = fileURLToPath(new URL(".", import.meta.url));
const root = path.resolve(web, "../..");
const dist = path.join(web, "dist");
const out = path.join(web, "dist-cf");

// 1. Build React + Tailwind bundle chuẩn vào apps/web/dist
await import("./build.mjs");

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "assets"), { recursive: true });
await mkdir(path.join(out, "icons"), { recursive: true });
await mkdir(path.join(out, "data"), { recursive: true });
await mkdir(path.join(out, "practice/config"), { recursive: true });
await mkdir(path.join(out, "practice/data"), { recursive: true });

// 2. Chép vỏ SPA, PWA, biểu tượng và các gói assets đã build (bỏ .map cho nhẹ)
for (const file of [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "model.mjs",
]) {
  const src = path.join(web, file);
  if (existsSync(src)) await copyFile(src, path.join(out, file));
}
await copyFile(
  path.join(web, "icons/vocaverse.svg"),
  path.join(out, "icons/vocaverse.svg"),
);
for (const file of await readdir(dist)) {
  if (/\.(js|css|woff2|txt)$/.test(file)) {
    await copyFile(path.join(dist, file), path.join(out, "assets", file));
  }
}

// 3. Chép cấu hình động cơ luyện tập (web-engines/practice)
const practice = path.join(root, "web-engines/practice");
for (const sub of ["config", "data"]) {
  const dir = path.join(practice, sub);
  if (!existsSync(dir)) continue;
  for (const file of await readdir(dir)) {
    if (file.endsWith(".json")) {
      await copyFile(
        path.join(dir, file),
        path.join(out, "practice", sub, file),
      );
    }
  }
}

// 4. Bảng thế bấm Sáo trúc C5
const fluteChartSrc = path.join(
  root,
  "engines/score/src/vocaverse_score/data/flute_charts/flute_chart_c5.v0.json",
);
if (existsSync(fluteChartSrc)) {
  await copyFile(fluteChartSrc, path.join(out, "data/flute-chart.json"));
}

// 5. Đóng gói 22 bài học cốt lõi (Piano PN01..PN12 + Sáo trúc C5 SA03..SA12-backup)
const EASY_IDS = new Set([
  "PN11",
  "PN12",
  "SA10-backup",
  "SA11-backup",
  "SA12-backup",
]);
const lessons = [];
for (const instrument of ["piano", "sao-truc"]) {
  const dir = path.join(root, "content", instrument);
  if (!existsSync(dir)) continue;
  for (const name of (await readdir(dir)).sort()) {
    const scorePath = path.join(dir, name, "score.vocascore.json");
    if (!existsSync(scorePath)) continue;
    const score = JSON.parse(await readFile(scorePath, "utf8"));
    const level =
      score.level ||
      score.parts?.[0]?.level ||
      (EASY_IDS.has(name) ? "easy" : "beginner");
    score.level = level;
    if (score.parts?.[0] && !score.parts[0].level) {
      score.parts[0].level = level;
    }
    lessons.push({
      id: name,
      title: score.title,
      level,
      score,
      instrument: instrument === "piano" ? "piano" : "sao_truc",
    });
  }
}
await writeFile(path.join(out, "data/lessons.json"), JSON.stringify(lessons));

// 6. Đóng gói danh mục 226 bài (16 cổ điển Public Domain + 210 bài tập kỹ thuật)
let generatedCatalog = { counts: {}, items: [], externalDependencies: {} };
const genPath = path.join(web, "src/practice/data/generated_catalog.json");
if (existsSync(genPath)) {
  generatedCatalog = JSON.parse(await readFile(genPath, "utf8"));
}

// 7. Tạo kho 12 bản phối trọn bài 20 ô nhịp (5 đoạn Intro -> Outro, Piano + Sáo C5, 3 độ khó)
// hoàn toàn từ các tác phẩm Phạm vi Công cộng toàn cầu (Public Domain <= 1955) — không dùng bài test bản quyền.
const PD_THEMES = [
  "Thư giãn",
  "Cổ điển",
  "Học đường",
  "Gia đình",
  "Quê hương",
  "Thiếu nhi",
  "Tết & Lễ hội",
  "Nhạc phim",
];
const pdItems = (generatedCatalog.items ?? []).filter(
  (it) => it.kind === "public_domain" && it.publishable === true,
);
const publicFullSongs = pdItems.slice(0, 12).map((item, idx) => {
  const code = `PD${String(idx + 1).padStart(2, "0")}`;
  const rawTitle = String(item.title || code).replace(
    /^PD-[A-Z]+-\d+\s*[—-]\s*/,
    "",
  );
  const notes = (item.score?.parts?.[0]?.notes ?? [])
    .map((n) => Number(n.pitch))
    .filter((p) => Number.isFinite(p) && p >= 48 && p <= 91);
  const motif =
    notes.length >= 8
      ? notes.slice(0, 16)
      : [60, 64, 67, 69, 67, 64, 62, 65, 69, 72, 71, 67, 64, 65, 62, 60];
  const mode = item.score?.key_map?.[0]?.mode === "minor" ? "minor" : "major";
  const tonic =
    item.score?.key_map?.[0]?.tonic || (mode === "minor" ? "A" : "C");
  const bpm = Math.round(
    Number(item.bpm || item.score?.tempo_map?.[0]?.bpm || 80),
  );
  const chords =
    mode === "minor"
      ? ["Am", "Dm", "G", "C", "F", "Dm", "E7", "Am"]
      : ["C", "G", "Am", "Em", "F", "C", "Dm", "G"];
  const { arrangements } = buildImportedArrangements({
    code,
    title: rawTitle,
    artist: item.composer || "Public Domain",
    bpm,
    tonic,
    mode,
    chords,
    motif,
  });
  for (const inst of ["piano", "sao_truc"]) {
    for (const diff of ["easy", "medium", "hard"]) {
      const sc = arrangements[inst][diff];
      sc.license = {
        ...sc.license,
        class: "public_domain",
        pd_scope: "global",
        attribution:
          item.score?.license?.attribution ||
          `${rawTitle} — Public Domain (tác giả mất <= 1955)`,
        expert_verified_by: null,
      };
    }
  }
  return {
    id: code,
    code,
    title: rawTitle,
    artist: item.composer || "Public Domain",
    theme: PD_THEMES[idx % PD_THEMES.length],
    genre: "Cổ điển / Public Domain",
    bpm,
    tonic,
    mode,
    chords,
    bars: 20,
    licenseClass: "public_domain",
    publishable: true,
    arrangements,
  };
});

await writeFile(
  path.join(out, "data/public-songs.json"),
  JSON.stringify({ count: publicFullSongs.length, songs: publicFullSongs }),
);
await writeFile(
  path.join(out, "data/catalog.json"),
  JSON.stringify({
    starterCount: lessons.length,
    localTestCount: publicFullSongs.length,
    counts: generatedCatalog.counts,
    externalDependencies: generatedCatalog.externalDependencies,
    items: generatedCatalog.items,
  }),
);

// 8. Tài sản Tay mẫu 3D PN01 công khai & báo cáo kiểm chứng T8
const demoDir = path.join(web, "public-demo");
const glbSrc = path.join(demoDir, "pn01_scene.glb");
if (existsSync(glbSrc)) {
  await mkdir(path.join(out, "models/lessons/PN01"), { recursive: true });
  await copyFile(glbSrc, path.join(out, "models/lessons/PN01/scene.glb"));
}
const t8Src = path.join(demoDir, "t8_snapshot.json");
if (existsSync(t8Src)) {
  await copyFile(t8Src, path.join(out, "data/t8.json"));
}

console.log(
  `Cloudflare Workers build hoàn tất: ${lessons.length} bài cốt lõi, ${publicFullSongs.length} bản trọn bài Public Domain 20 ô nhịp -> apps/web/dist-cf`,
);
