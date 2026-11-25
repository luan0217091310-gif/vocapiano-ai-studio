import {
  ArrowDownWideNarrow,
  Columns2,
  FileMusic,
  ListMusic,
  LockKeyhole,
  Repeat2,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  tickToMs,
  barStartTick,
} from "../../../../web-engines/practice/src/timing.ts";
import { noteName } from "../../model.mjs";
import { useAnimation } from "../studio/useStudio.js";

const colorOf = (note, status, conceal) =>
  !conceal && status
    ? ({ hit: "#10b981", timing: "#f59e0b", wrong: "#ef4444", miss: "#ef4444" }[
        status
      ] ?? "#64748b")
    : note.hand === "L"
      ? "#ff8c83"
      : "#00d8ef";
const dynamicOf = (n) =>
  n.velocity <= 60 ? "p" : n.velocity >= 90 ? "f" : "mf";
function NoteRoll({ index, height, width, scale, state, conceal }) {
  const pitches = index.expected.map((e) => e.note.pitch),
    min = Math.min(...pitches) - 2,
    max = Math.max(...pitches) + 2;
  const rows = max - min + 1,
    row = (height - 43) / rows;
  return (
    <>
      {Array.from({ length: rows }, (_, i) => {
        const p = max - i,
          y = 30 + i * row;
        return (
          <g key={p}>
            <rect
              x="0"
              y={y}
              width={width}
              height={row}
              fill={[1, 3, 6, 8, 10].includes(p % 12) ? "#0c111a" : "#101722"}
            />
            <line
              x1="44"
              x2={width}
              y1={y + row}
              y2={y + row}
              stroke={p % 12 === 0 ? "#293648" : "#1a2432"}
              strokeWidth=".6"
            />
            <text
              x="8"
              y={y + row * 0.7}
              fill={p % 12 === 0 ? "#9aa9bd" : "#455267"}
              fontSize="10"
              fontFamily="monospace"
            >
              {p % 12 === 0 ? noteName(p) : ""}
            </text>
          </g>
        );
      })}
      {index.expected.map((e) => {
        const x = 60 + e.onMs * scale,
          y = 30 + (max - e.note.pitch) * row + 2,
          w = Math.max(19, e.durMs * scale - 4),
          status = state.noteStates[e.idx],
          color = colorOf(e, status, conceal),
          hint = state.pitchHint,
          wrongHint =
            !conceal && hint?.idx === e.idx && hint.diff && status !== "hit"
              ? hint.diff
              : 0;
        return (
          <g
            key={e.idx}
            className={`roll-note ${!conceal && status === "hit" ? "is-hit" : ""} ${wrongHint ? "is-wrong" : ""}`}
            data-note={e.idx}
          >
            {wrongHint !== 0 && (
              <text
                x={x}
                y={y - 5}
                fill="#fca5a5"
                fontSize="10"
                fontWeight="600"
                className="pitch-hint"
              >
                {wrongHint > 0
                  ? `▲ cao hơn ${wrongHint} nửa cung`
                  : `▼ thấp hơn ${-wrongHint} nửa cung`}
              </text>
            )}
            <rect
              x={x}
              y={y}
              width={w}
              height={Math.max(11, row - 3)}
              rx="3"
              fill={color}
              fillOpacity=".16"
              stroke={color}
              strokeOpacity=".65"
            />
            <rect
              x={x}
              y={y}
              width="3"
              height={Math.max(11, row - 3)}
              rx="1"
              fill={color}
            />
            <text
              x={x + 6}
              y={y + Math.max(11, row - 3) / 2 + 3.5}
              fill={color}
              fontSize="10"
              fontFamily="Inter, sans-serif"
            >
              {noteName(e.note.pitch)}
            </text>
            {!conceal && e.note.technique?.finger && (
              <text
                x={x + 3}
                y={y - 3}
                fill={color}
                opacity=".65"
                fontSize="9"
                fontFamily="monospace"
              >
                {e.note.technique.finger}
              </text>
            )}
            {w > 65 && (
              <text
                x={x + w - 8}
                y={y + Math.max(11, row - 3) / 2 + 3.5}
                textAnchor="end"
                fill={color}
                opacity=".65"
                fontSize="10"
                fontStyle="italic"
              >
                {dynamicOf(e.note)}
              </text>
            )}
            <title>
              {noteName(e.note.pitch)} · ô {e.bar} · {dynamicOf(e.note)} ·{" "}
              {e.note.articulations.join(", ") || "thường"}
              {!conceal && e.note.technique?.finger
                ? ` · ngón ${e.note.technique.finger}`
                : ""}
            </title>
          </g>
        );
      })}
    </>
  );
}
// Hoá biểu: số dấu giáng/thăng theo chủ âm (trưởng) hoặc chủ âm thứ.
const FIFTHS = {
  major: {
    C: 0,
    G: 1,
    D: 2,
    A: 3,
    E: 4,
    B: 5,
    F: -1,
    Bb: -2,
    Eb: -3,
    Ab: -4,
    Db: -5,
  },
  minor: { A: 0, E: 1, B: 2, "F#": 3, D: -1, G: -2, C: -3, F: -4 },
};
const fifthsOf = (key) =>
  FIFTHS[key?.mode === "minor" ? "minor" : "major"][key?.tonic] ?? 0;
// Bậc diatonic (C=0…B=6) của các nốt trong hoá biểu.
const SIG_SHARPS = [38, 35, 39, 36, 33, 37, 34],
  SIG_FLATS = [34, 37, 33, 36, 32, 35, 31];
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6],
  FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
/** Đánh vần cao độ theo hoá biểu: trả về bậc trên khuông và dấu hoá cần in (null nếu thuộc hoá biểu). */
function spell(pitch, fifths) {
  const pc = pitch % 12,
    oct = Math.floor(pitch / 12) - 1;
  const inKey = new Map();
  for (let i = 0; i < Math.abs(fifths); i++) {
    const deg = (fifths > 0 ? SHARP_ORDER : FLAT_ORDER)[i];
    inKey.set(deg, fifths > 0 ? 1 : -1);
  }
  const nat = NATURAL.indexOf(pc);
  if (nat >= 0)
    return { step: oct * 7 + nat, acc: inKey.has(nat) ? "♮" : null };
  // Nốt đen: chọn cách viết khớp hoá biểu, mặc định thăng ở giọng thăng/C, giáng ở giọng giáng.
  const up = NATURAL.indexOf(pc - 1),
    down = NATURAL.indexOf(pc + 1);
  if (inKey.get(up) === 1) return { step: oct * 7 + up, acc: null };
  if (inKey.get(down) === -1) return { step: oct * 7 + down, acc: null };
  return fifths < 0
    ? { step: oct * 7 + down, acc: "♭" }
    : { step: oct * 7 + up, acc: "♯" };
}
const restGlyph = (ticks, ppq) =>
  ticks >= ppq * 4
    ? "whole"
    : ticks >= ppq * 2
      ? "half"
      : ticks >= ppq
        ? "quarter"
        : "eighth";
function Rest({ x, bottom, gap, kind, color }) {
  if (kind === "whole" || kind === "half")
    return (
      <rect
        x={x - 6}
        y={kind === "whole" ? bottom - gap * 3 : bottom - gap * 2.5}
        width="12"
        height={gap * 0.5}
        fill={color}
      />
    );
  if (kind === "quarter")
    return (
      <path
        d={`M${x - 2} ${bottom - gap * 3.6}l5 5-4 4 5 5q-6-2-6 3l-3-4q4-3 1-5l4-4z`}
        fill={color}
      />
    );
  return (
    <g fill={color}>
      <circle cx={x - 2} cy={bottom - gap * 2.6} r="2.2" />
      <path
        d={`M${x - 2} ${bottom - gap * 2.6}q4 1 6-2l-5 ${gap * 2.4}`}
        stroke={color}
        strokeWidth="1.3"
        fill="none"
      />
    </g>
  );
}
function Staff({ index, width, height, scale, state, conceal, keyInfo }) {
  const mid = height / 2,
    gap = Math.max(6, Math.min(10, (height - 90) / 18));
  const singleStaff = index.clip.instrument !== "piano";
  const flute = index.clip.instrument === "sao_truc";
  const trebleBottom = singleStaff ? mid + gap * 2 : mid - 17,
    bassBottom = mid + gap * 7;
  const fifths = fifthsOf(keyInfo);
  const sigW = Math.abs(fifths) * 7;
  const x0 = 68 + sigW;
  const xOf = (e) => x0 + e.onMs * scale;
  const yStep = (step, hand) =>
    hand === "L"
      ? bassBottom - ((step - 18) * gap) / 2
      : trebleBottom - ((step - 30) * gap) / 2;
  const spelled = new Map(
    index.expected.map((e) => [e.idx, spell(e.note.pitch, fifths)]),
  );
  const yOf = (e) => yStep(spelled.get(e.idx).step, e.hand);
  const ppq = index.clip.ppq;
  // Dấu lặng: khoảng trống giữa các nốt liên tiếp trên cùng tay (kể cả đầu đoạn).
  const rests = [];
  for (const hand of singleStaff ? [null] : ["R", "L"]) {
    const notes = index.expected
      .filter((e) => hand === null || e.hand === hand)
      .sort((a, b) => a.note.tick - b.note.tick);
    let cursor = 0;
    for (const e of notes) {
      const gapTicks = e.note.tick - cursor;
      if (gapTicks >= ppq / 2) {
        rests.push({
          key: `${hand}:${cursor}`,
          x: x0 + tickToMs(index.tm, cursor) * scale + 8,
          hand: hand ?? "R",
          kind: restGlyph(gapTicks, ppq),
        });
      }
      cursor = Math.max(cursor, e.note.tick + e.note.dur_tick);
    }
  }
  let lastDyn = null;
  const hint = state.pitchHint;
  // Hợp âm: gom nốt cùng tay, cùng tick để xếp số ngón thành cột, không chồng nhau.
  const chords = new Map();
  for (const e of index.expected) {
    const k = `${e.hand}:${e.note.tick}`;
    chords.set(k, [...(chords.get(k) ?? []), e]);
  }
  const chordOf = (e) => {
    const group = chords.get(`${e.hand}:${e.note.tick}`);
    const sorted = [...group].sort((a, b) => a.note.pitch - b.note.pitch);
    return {
      rank: sorted.indexOf(e),
      top: Math.min(...group.map(yOf)),
      size: group.length,
    };
  };
  return (
    <>
      <rect width={width} height={height} fill="#111924" />
      {(singleStaff ? [trebleBottom] : [trebleBottom, bassBottom]).map(
        (bottom, i) => (
          <g key={i}>
            {Array.from({ length: 5 }, (_, j) => (
              <line
                key={j}
                x1="44"
                x2={width}
                y1={bottom - j * gap}
                y2={bottom - j * gap}
                stroke="#455066"
                strokeWidth=".75"
              />
            ))}
            <text
              x="8"
              y={bottom - gap * 0.3}
              fill="#a5b3ca"
              fontSize={gap * 5}
              fontFamily="Segoe UI Symbol, serif"
            >
              {i ? "𝄢" : "𝄞"}
            </text>
            {Array.from({ length: Math.abs(fifths) }, (_, k) => {
              // Vị trí hoá biểu chuẩn trên khoá Sol; khoá Fa thấp hơn hai quãng 8 về bậc.
              const step =
                (fifths > 0 ? SIG_SHARPS : SIG_FLATS)[k] - (i ? 14 : 0);
              const y = yStep(step, i ? "L" : "R");
              return (
                <text
                  key={k}
                  x={40 + k * 7}
                  y={y + 4}
                  fill="#a5b3ca"
                  fontSize={gap * 1.8}
                >
                  {fifths > 0 ? "♯" : "♭"}
                </text>
              );
            })}
            <text
              x={44 + sigW}
              y={bottom - gap * 2.4}
              fill="#a5b3ca"
              fontFamily="serif"
              fontSize={gap * 1.7}
            >
              {index.clip.meter_map[0].numerator}
            </text>
            <text
              x={44 + sigW}
              y={bottom - gap * 0.4}
              fill="#a5b3ca"
              fontFamily="serif"
              fontSize={gap * 1.7}
            >
              {index.clip.meter_map[0].denominator}
            </text>
          </g>
        ),
      )}
      {rests.map((r) => (
        <Rest
          key={r.key}
          x={r.x}
          bottom={r.hand === "L" ? bassBottom : trebleBottom}
          gap={gap}
          kind={r.kind}
          color="#7d8ca3"
        />
      ))}
      {index.expected.map((e) => {
        const x = xOf(e),
          y = yOf(e),
          status = state.noteStates[e.idx],
          color = colorOf(e, status, conceal),
          dur = e.note.dur_tick,
          hollow = dur >= ppq * 2;
        const bottom = e.hand === "L" ? bassBottom : trebleBottom;
        const stemUp = y > bottom - gap * 2;
        const stemX = stemUp ? x + 5.5 : x - 5.5,
          stemEnd = stemUp ? y - gap * 3.3 : y + gap * 3.3;
        const luyen = e.note.ornaments?.find((o) => o.type === "luyen");
        const next =
          e.note.articulations.includes("legato") || luyen
            ? index.expected.find(
                (n) =>
                  n.idx > e.idx &&
                  n.hand === e.hand &&
                  n.note.tick >= e.note.tick + e.note.dur_tick,
              )
            : null;
        const ledgers = [];
        if (y >= bottom + gap)
          for (let ly = bottom + gap; ly <= y + 1; ly += gap) ledgers.push(ly);
        if (y <= bottom - 5 * gap)
          for (let ly = bottom - 5 * gap; ly >= y - 1; ly -= gap)
            ledgers.push(ly);
        const dyn = dynamicOf(e.note),
          showDyn = dyn !== lastDyn;
        lastDyn = dyn;
        const acc = spelled.get(e.idx).acc;
        const flags = dur < ppq / 2 ? 2 : dur < ppq ? 1 : 0;
        const wrongHint =
          !conceal &&
          hint &&
          hint.idx === e.idx &&
          hint.diff &&
          status !== "hit"
            ? hint.diff
            : 0;
        return (
          <g
            key={e.idx}
            className={`staff-note ${!conceal && status === "hit" ? "is-hit" : ""} ${wrongHint ? "is-wrong" : ""}`}
            data-note={e.idx}
          >
            {ledgers.map((ly) => (
              <line
                key={ly}
                x1={x - 10}
                x2={x + 10}
                y1={ly}
                y2={ly}
                stroke="#63728a"
              />
            ))}
            {!conceal && status === "hit" && (
              <circle cx={x} cy={y} r="11" className="hit-glow" />
            )}
            <ellipse
              cx={x}
              cy={y}
              rx="6"
              ry="4.2"
              transform={`rotate(-18 ${x} ${y})`}
              fill={hollow ? "#111924" : color}
              stroke={color}
              strokeWidth="1.4"
            />
            {[ppq * 0.75, ppq * 1.5, ppq * 3].includes(dur) && (
              <circle cx={x + 10} cy={y - 1} r="1.6" fill={color} />
            )}
            {dur < ppq * 4 && (
              <line
                x1={stemX}
                x2={stemX}
                y1={y}
                y2={stemEnd}
                stroke={color}
                strokeWidth="1.2"
              />
            )}
            {Array.from({ length: flags }, (_, k) => {
              const fy = stemEnd + (stemUp ? k * 5 : -k * 5);
              return (
                <path
                  key={k}
                  d={
                    stemUp
                      ? `M${stemX} ${fy}q9 4 6 13`
                      : `M${stemX} ${fy}q9 -4 6 -13`
                  }
                  stroke={color}
                  strokeWidth="1.3"
                  fill="none"
                />
              );
            })}
            {acc && (
              <text x={x - 17} y={y + 4.5} fill={color} fontSize="15">
                {acc}
              </text>
            )}
            {e.note.articulations.includes("staccato") && (
              <circle
                cx={x}
                cy={stemUp ? y + gap * 1.2 : y - gap * 1.2}
                r="1.8"
                fill={color}
              />
            )}
            {e.note.articulations.includes("tenuto") && (
              <line
                x1={x - 5}
                x2={x + 5}
                y1={stemUp ? y + gap * 1.2 : y - gap * 1.2}
                y2={stemUp ? y + gap * 1.2 : y - gap * 1.2}
                stroke={color}
                strokeWidth="1.4"
              />
            )}
            {next && (
              <path
                d={`M${x + 2} ${y + gap * 1.3} Q${(x + xOf(next)) / 2} ${Math.max(y, yOf(next)) + gap * 3.2} ${xOf(next) - 2} ${yOf(next) + gap * 1.3}`}
                fill="none"
                stroke={luyen ? "#7dd3fc" : color}
                strokeWidth={luyen ? 1.4 : 0.9}
                opacity={luyen ? 0.9 : 0.6}
              />
            )}
            {flute && luyen && (
              <text
                x={(x + (next ? xOf(next) : x + 30)) / 2}
                y={Math.max(y, next ? yOf(next) : y) + gap * 4.4}
                textAnchor="middle"
                fill="#7dd3fc"
                fontSize="9"
              >
                luyến
              </text>
            )}
            {showDyn && (
              <text
                x={x}
                y={bottom + gap * 3.4}
                textAnchor="middle"
                fill="#9aaac0"
                fontSize="12"
                fontStyle="italic"
                fontWeight="700"
                fontFamily="Georgia, serif"
              >
                {dyn}
              </text>
            )}
            {!conceal && e.note.technique?.finger && (
              <text
                x={x}
                y={
                  chordOf(e).size > 1
                    ? chordOf(e).top - gap * 3.6 - chordOf(e).rank * 10
                    : stemUp
                      ? stemEnd - 4
                      : y - gap * 1.6
                }
                textAnchor="middle"
                fill={color}
                opacity=".85"
                fontSize="10"
                fontWeight="600"
              >
                {e.note.technique.finger}
              </text>
            )}
            {wrongHint !== 0 && (
              <g className="pitch-hint">
                <rect
                  x={x - 26}
                  y={y - 30}
                  width="52"
                  height="16"
                  rx="8"
                  fill="#3b1219"
                  stroke="#ef4444"
                />
                <text
                  x={x}
                  y={y - 18.5}
                  textAnchor="middle"
                  fill="#fca5a5"
                  fontSize="10"
                  fontWeight="600"
                >
                  {wrongHint > 0 ? "▲ cao hơn" : "▼ thấp hơn"}
                </text>
              </g>
            )}
            <title>
              {noteName(e.note.pitch)} · ô {e.bar} · {dyn}
              {e.note.articulations.length
                ? ` · ${e.note.articulations.join(", ")}`
                : ""}
              {luyen ? " · luyến" : ""}
              {!conceal && e.note.technique?.finger
                ? ` · ngón ${e.note.technique.finger}`
                : ""}
            </title>
          </g>
        );
      })}
    </>
  );
}
function MusicCanvas({ s, controller: c, kind }) {
  const viewport = useRef(),
    playhead = useRef();
  const [size, setSize] = useState({ width: 800, height: 300 });
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ width: r.width, height: r.height });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const duration = c.index ? tickToMs(c.index.tm, c.clip.endTick) : 1;
  const scale = Math.max(0.035, (size.width - 120) / duration),
    width = Math.max(size.width, duration * scale + 100),
    height = Math.max(150, size.height);
  const keyInfo = s.lesson?.score?.key_map?.[0];
  // Gốc trục thời gian: khuông nhạc chừa chỗ cho khoá, hoá biểu và số chỉ nhịp.
  const origin = kind === "sheet" ? 68 + Math.abs(fifthsOf(keyInfo)) * 7 : 60;
  useAnimation(() => {
    const x = origin + c.progress() * scale;
    if (playhead.current)
      playhead.current.style.transform = `translate3d(${x}px,0,0)`;
    const v = viewport.current;
    if (v && c.run && s.status !== "paused") {
      if (x > v.scrollLeft + v.clientWidth - 100)
        v.scrollLeft = x - v.clientWidth * 0.35;
      else if (x < v.scrollLeft) v.scrollLeft = Math.max(0, x - 60);
    }
  });
  useEffect(() => {
    if (viewport.current) viewport.current.scrollLeft = 0;
  }, [s.lesson, s.from, s.to]);
  const conceal = s.mode === "exam" && c.run?.kind !== "demo";
  return (
    <div
      ref={viewport}
      className={`music-canvas ${kind}`}
      tabIndex="0"
      aria-label={
        kind === "roll" ? "Piano roll tương tác" : "Khuông nhạc xem trước"
      }
    >
      <div className="music-track" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${s.lesson?.id} · ${kind === "roll" ? "piano roll" : "khuông nhạc"}`}
        >
          {c.index &&
            (kind === "roll" ? (
              <NoteRoll
                index={c.index}
                height={height}
                width={width}
                scale={scale}
                state={s}
                conceal={conceal}
              />
            ) : (
              <Staff
                index={{ ...c.index, clip: c.clip }}
                width={width}
                height={height}
                scale={scale}
                state={s}
                conceal={conceal}
                keyInfo={keyInfo}
              />
            ))}
          {c.index &&
            Array.from({ length: s.to - s.from + 1 }, (_, i) => {
              const bar = s.from + i,
                t =
                  barStartTick(c.clip.originMeter, c.clip.ppq, bar) -
                  c.clip.originTick,
                x =
                  (kind === "sheet" ? origin - 14 : origin) +
                  tickToMs(c.index.tm, t) * scale;
              const stat = s.barStats?.find((b) => b.bar === bar);
              return (
                <g key={bar}>
                  {!(kind === "sheet" && i === 0) && (
                    <line
                      x1={x}
                      x2={x}
                      y1="25"
                      y2={height}
                      stroke="#38465b"
                      strokeOpacity=".65"
                    />
                  )}
                  {stat && !conceal && (
                    <rect
                      x={x + 4}
                      y="5"
                      width="22"
                      height="16"
                      rx="4"
                      className={`bar-score ${stat.accuracy >= 0.8 ? "good" : stat.accuracy >= 0.5 ? "mid" : "low"}`}
                    />
                  )}
                  <text
                    x={x + 8}
                    y="17"
                    fill={stat && !conceal ? "#e2e8f0" : "#6d7f99"}
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    {String(bar).padStart(2, "0")}
                  </text>
                  {kind === "roll" &&
                    (() => {
                      const first = c.index.expected.find((e) => e.bar === bar);
                      return first ? (
                        <text
                          x={x + 33}
                          y="17"
                          fill="#6d879d"
                          fontSize="9"
                          fontStyle="italic"
                        >
                          {dynamicOf(first.note)}
                          {first.note.articulations.includes("legato")
                            ? " · legato"
                            : first.note.articulations.includes("staccato")
                              ? " · stacc."
                              : ""}
                        </text>
                      ) : null;
                    })()}
                </g>
              );
            })}
        </svg>
        <div className="playhead-line" ref={playhead}>
          <i />
        </div>
      </div>
    </div>
  );
}
function WaterfallCanvas({ s, controller: c }) {
  const wrapRef = useRef(null);
  const [nowMs, setNowMs] = useState(0);
  useAnimation(() => {
    setNowMs(c.progress());
  });
  const expected = c.index?.expected ?? [];
  const pitches = expected.length
    ? expected.map((e) => e.note.pitch)
    : [60, 72];
  const minP = Math.min(...pitches) - 2;
  const maxP = Math.max(...pitches) + 2;
  const span = Math.max(12, maxP - minP + 1);
  const windowMs = 4500;
  const conceal = s.mode === "exam" && c.run?.kind !== "demo";

  return (
    <div
      ref={wrapRef}
      className="music-canvas waterfall"
      tabIndex="0"
      aria-label="Thác nốt rơi tương tác"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 220,
        background:
          "linear-gradient(180deg, #090E1A 0%, #0F172A 88%, #132038 100%)",
        overflow: "hidden",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 800 320"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${s.lesson?.id} · thác nốt rơi`}
      >
        {Array.from({ length: span }, (_, i) => {
          const p = minP + i;
          const x = (i / span) * 800;
          const w = 800 / span;
          const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
          return (
            <g key={p}>
              <rect
                x={x}
                y="0"
                width={w}
                height="282"
                fill={isBlack ? "rgba(15,23,42,0.55)" : "rgba(30,41,59,0.22)"}
              />
              <line
                x1={x}
                x2={x}
                y1="0"
                y2="282"
                stroke={p % 12 === 0 ? "#334155" : "#1E293B"}
                strokeWidth="0.8"
              />
              <text
                x={x + w / 2}
                y="306"
                textAnchor="middle"
                fill={p % 12 === 0 ? "#38BDF8" : "#64748B"}
                fontSize="9"
                fontFamily="monospace"
              >
                {noteName(p)}
              </text>
            </g>
          );
        })}
        <line
          x1="0"
          x2="800"
          y1="282"
          y2="282"
          stroke="#06B6D4"
          strokeWidth="2.5"
        />
        {expected.map((e) => {
          const dt = e.onMs - nowMs;
          const endDt = e.onMs + e.durMs - nowMs;
          if (endDt < -400 || dt > windowMs) return null;
          const colIdx = e.note.pitch - minP;
          const w = Math.max(18, 800 / span - 4);
          const x = (colIdx / span) * 800 + 2;
          const yBottom = 282 - (dt / windowMs) * 260;
          const h = Math.max(18, (e.durMs / windowMs) * 260);
          const yTop = yBottom - h;
          const status = s.noteStates[e.idx];
          const color = colorOf(e, status, conceal);
          return (
            <g key={e.idx}>
              <rect
                x={x}
                y={yTop}
                width={w}
                height={h}
                rx="6"
                fill={color}
                fillOpacity="0.28"
                stroke={color}
                strokeWidth="1.6"
              />
              <text
                x={x + w / 2}
                y={yTop + Math.min(h - 4, 14)}
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize="9"
                fontWeight="700"
              >
                {noteName(e.note.pitch)}
                {!conceal && e.note.technique?.finger
                  ? ` · ${e.note.technique.finger}`
                  : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
export default function MusicVisualizer({ s, controller: c, view, setView }) {
  const busy = !!c.run || s.status === "starting";
  const shortTitle = s.lesson?.title.replace(/ \(.+$/, "");
  return (
    <section className="visualizer-panel panel">
      <div className="score-heading">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">
              {s.lesson?.instrument === "sao_truc"
                ? "SÁO TRÚC / C5"
                : "PIANO / LỘ TRÌNH CƠ BẢN"}
            </span>
            <span className="subtle-badge">{s.lesson?.id}</span>
          </div>
          <h1>{shortTitle?.replace(/^(PN|SA)\d+\s*[—–-]\s*/, "")}</h1>
          <div className="score-meta">
            <span className="mono">{c.full?.baseTempo[0].bpm} BPM</span>
            <i />
            <span>
              {c.full?.meter_map[0].numerator}/
              {c.full?.meter_map[0].denominator}
            </span>
            <i />
            <span>
              Khóa Sol / {s.lesson?.instrument === "sao_truc" ? "Sáo C5" : "Fa"}
            </span>
            <i />
            <span>{c.full?.bars[1]} ô nhịp</span>
          </div>
        </div>
        <div className="mode-indicator">
          <span className="tiny-dot" />
          {s.mode === "exam"
            ? "Kiểm tra lưu giữ"
            : s.practice === "wait"
              ? "Chờ đúng nốt"
              : "Luyện tập tự do"}
          <small>
            {s.mode === "exam" ? "Góp ý sau lượt" : "Gợi ý khi cần"}
          </small>
        </div>
      </div>
      <div className="score-toolbar">
        <div className="segmented view-tabs" aria-label="Kiểu bản nhạc">
          <button
            className={view === "roll" ? "active" : ""}
            onClick={() => setView("roll")}
          >
            <ListMusic size={14} />
            <span>Piano Roll</span>
          </button>
          <button
            className={view === "sheet" ? "active" : ""}
            onClick={() => setView("sheet")}
          >
            <FileMusic size={14} />
            <span>Khuông nhạc</span>
          </button>
          <button
            className={view === "dual" ? "active" : ""}
            aria-label="Hiện song song"
            title="Hiện song song"
            onClick={() => setView("dual")}
          >
            <Columns2 size={14} />
          </button>
          <button
            className={view === "waterfall" ? "active" : ""}
            aria-label="Thác nốt rơi"
            title="Thác nốt rơi (Synthesia / Simply Piano style)"
            onClick={() => setView("waterfall")}
          >
            <ArrowDownWideNarrow size={14} />
            <span>Thác nốt</span>
          </button>
        </div>
        <div className="score-settings">
          {s.lesson?.catalogSong && (
            <div
              className="segmented"
              role="group"
              aria-label="Độ khó và nhạc cụ"
              style={{ marginRight: 6 }}
            >
              {["easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
                  className={s.songDifficulty === d ? "active" : ""}
                  onClick={() => c.setArrangement(s.lesson.instrument, d)}
                >
                  {d === "easy" ? "Dễ" : d === "medium" ? "Vừa" : "Khó"}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                title="Đổi nhạc cụ Piano / Sáo trúc C5 cho bài này"
                onClick={() =>
                  c.setArrangement(
                    s.lesson.instrument === "piano" ? "sao_truc" : "piano",
                    s.songDifficulty,
                  )
                }
              >
                {s.lesson.instrument === "piano" ? "→ Sáo C5" : "→ Piano"}
              </button>
            </div>
          )}
          <label
            className="tempo-control"
            title="Tốc độ luyện so với bản gốc (25% - 150%)"
          >
            <SlidersHorizontal size={13} />
            <select
              aria-label="Tốc độ"
              value={s.speed}
              disabled={busy}
              onChange={(e) => c.configure({ speed: e.target.value })}
            >
              {[25, 50, 60, 70, 75, 80, 100, 110, 125, 150].map((v) => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
            </select>
          </label>
          <div className={`loop-control ${s.loop ? "enabled" : ""}`}>
            <button
              aria-label="Bật hoặc tắt lặp A B"
              title="Lặp A–B (không dùng trong kiểm tra)"
              disabled={busy || s.mode === "exam"}
              onClick={() => c.configure({ loop: !s.loop })}
            >
              <Repeat2 size={15} />
            </button>
            <label>
              A
              <input
                aria-label="Từ ô"
                type="number"
                min="1"
                max={c.full?.bars[1]}
                value={s.from}
                disabled={busy}
                onChange={(e) => c.configure({ from: e.target.value })}
              />
            </label>
            <span>—</span>
            <label>
              B
              <input
                aria-label="Đến ô"
                type="number"
                min={s.from}
                max={c.full?.bars[1]}
                value={s.to}
                disabled={busy}
                onChange={(e) => c.configure({ to: e.target.value })}
              />
            </label>
          </div>
        </div>
      </div>
      {/* Thanh nhảy đoạn (Intro/Verse/Chorus/Bridge/Outro) & Tua nhanh ô nhịp */}
      {c.full?.bars?.[1] >= 8 && (
        <div
          className="section-scrubber-bar"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            padding: "4px 12px 6px",
            borderBottom: "1px solid rgba(51,65,85,0.45)",
            fontSize: 11,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              alignItems: "center",
            }}
          >
            <span style={{ color: "#94A3B8", marginRight: 2 }}>Đoạn nhạc:</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => c.jumpToSection(1, c.full.bars[1])}
              style={{
                padding: "2px 8px",
                borderRadius: 99,
                border: "1px solid #334155",
                background:
                  s.from === 1 && s.to === c.full.bars[1]
                    ? "#06B6D4"
                    : "#0F172A",
                color:
                  s.from === 1 && s.to === c.full.bars[1]
                    ? "#04131D"
                    : "#CBD5E1",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Trọn bài (1–{c.full.bars[1]})
            </button>
            {(c.full.bars[1] >= 16
              ? [
                  ["Intro", 1, 4],
                  ["Verse", 5, 8],
                  ["Chorus", 9, 12],
                  ["Bridge", 13, 16],
                  ["Outro", 17, c.full.bars[1]],
                ]
              : [
                  ["Câu 1", 1, 4],
                  ["Câu 2", 5, c.full.bars[1]],
                ]
            ).map(([label, bStart, bEnd]) => {
              const activeSec = s.from === bStart && s.to === bEnd;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={busy}
                  onClick={() => c.jumpToSection(bStart, bEnd)}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 99,
                    border: "1px solid #334155",
                    background: activeSec ? "#06B6D4" : "#0F172A",
                    color: activeSec ? "#04131D" : "#CBD5E1",
                    fontWeight: activeSec ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {label} ({bStart}–{bEnd})
                </button>
              );
            })}
          </div>
          {s.lesson?.qualityNote && (
            <span
              style={{
                color: "#FCD34D",
                background: "rgba(245,158,11,0.14)",
                padding: "2px 8px",
                borderRadius: 99,
                fontWeight: 600,
              }}
            >
              ⚠ {s.lesson.qualityNote}
            </span>
          )}
        </div>
      )}
      <div className={`visualizer-body ${view === "dual" ? "dual-view" : ""}`}>
        {view === "waterfall" ? (
          <WaterfallCanvas
            key={`${s.lesson?.id}:${s.from}:${s.to}:${s.speed}:waterfall`}
            s={s}
            controller={c}
          />
        ) : (
          <MusicCanvas
            key={`${s.lesson?.id}:${s.from}:${s.to}:${s.speed}:${view}`}
            s={s}
            controller={c}
            kind={view === "sheet" ? "sheet" : "roll"}
          />
        )}
        {view === "dual" && <MusicCanvas s={s} controller={c} kind="sheet" />}
        {s.mode === "exam" && c.run?.kind !== "demo" && (
          <div className="exam-label">
            <LockKeyhole size={12} />
            Gợi ý ngón & phản hồi trực tiếp đã ẩn
          </div>
        )}
      </div>
      <div className="score-legend">
        <span>
          <i className="cyan" />
          Tay phải
        </span>
        <span>
          <i className="coral" />
          Tay trái
        </span>
        <div className="legend-divider" />
        <span>
          <i className="emerald" />
          Đúng
        </span>
        <span>
          <i className="amber" />
          Lệch nhịp
        </span>
        <span>
          <i className="crimson" />
          Sai / thiếu
        </span>
        <small>
          {view === "roll"
            ? "Độ dài thanh = trường độ"
            : "Khuông nhạc · bản xem trước"}
        </small>
      </div>
    </section>
  );
}
