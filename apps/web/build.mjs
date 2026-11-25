import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  readdir,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = fileURLToPath(new URL(".", import.meta.url));
await mkdir(path.join(dir, "dist"), { recursive: true });
await build({
  // Chia bundle: trang/khối 3D (three.js) tải riêng khi cần, trang chủ nhẹ hơn.
  entryPoints: { studio: path.join(dir, "src/main.jsx") },
  bundle: true,
  outdir: path.join(dir, "dist"),
  splitting: true,
  chunkNames: "chunk-[name]-[hash]",
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: true,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const css = await postcss([
  tailwind({
    content: [path.join(dir, "src/**/*.{js,jsx}")],
    theme: {
      extend: {
        colors: {
          obsidian: "#0B0E14",
          surface: "#141923",
          cyan: "#00E5FF",
          coral: "#FF6B6B",
        },
      },
    },
    plugins: [],
  }),
  autoprefixer,
]).process(
  (
    await Promise.all(
      ["src/studio.css", "src/pages/pages.css", "src/ui/ui.css"].map((f) =>
        readFile(path.join(dir, f), "utf8"),
      ),
    )
  ).join("\n"),
  {
    from: path.join(dir, "src/studio.css"),
  },
);
await writeFile(path.join(dir, "dist/studio.css"), css.css);
for (const [source, target] of [
  ["@fontsource/inter/files/inter-latin-400-normal.woff2", "inter-latin.woff2"],
  [
    "@fontsource/inter/files/inter-vietnamese-400-normal.woff2",
    "inter-vietnamese.woff2",
  ],
  [
    "@fontsource/inter/files/inter-latin-600-normal.woff2",
    "inter-latin-semibold.woff2",
  ],
  [
    "@fontsource/inter/files/inter-vietnamese-600-normal.woff2",
    "inter-vietnamese-semibold.woff2",
  ],
  [
    "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2",
    "jetbrains-mono.woff2",
  ],
])
  await copyFile(
    path.join(dir, "node_modules", source),
    path.join(dir, "dist", target),
  );
console.log("Practice Studio: React + Tailwind build hoàn tất.");
for (const file of await readdir(path.join(dir, "third-party"))) {
  if (file.endsWith(".txt"))
    await copyFile(
      path.join(dir, "third-party", file),
      path.join(dir, "dist", file),
    );
}
