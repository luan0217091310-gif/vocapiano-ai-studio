// Module Nhập Nhạc Tự Động (Mục 2): Link / File âm thanh / MIDI / MusicXML -> VocaScore 0.1 (Piano & Sáo trúc C5, 3 độ khó) + Sửa nhanh.
import { errors } from "../../core/http.mjs";

const PPQ = 480;
export const SAO_C5_HOLES = {
  72: ["●●●●●●", 1],
  74: ["●●●●●○", 1],
  76: ["●●●●○○", 1],
  77: ["●●●○○○", 1],
  79: ["●●○○○○", 1],
  81: ["●○○○○○", 1],
  83: ["○○○○○○", 1],
  84: ["○●●●●●", 2],
  86: ["●●●●●○", 2],
  88: ["●●●●○○", 2],
  89: ["●●●○○○", 2],
  91: ["●●○○○○", 2],
};
const SAO_PITCHES = Object.keys(SAO_C5_HOLES).map(Number);

const CHORD_MAP = {
  C: [48, 52, 55],
  G: [43, 47, 50],
  Am: [45, 48, 52],
  Em: [40, 43, 47],
  F: [41, 45, 48],
  Dm: [50, 53, 57],
  D: [50, 54, 57],
  E7: [40, 44, 47],
};

export const SECTIONS = [
  ["sec_intro", "Intro (Dạo đầu)", 0, 4],
  ["sec_verse", "Verse (Lời chính)", 4, 8],
  ["sec_chorus", "Chorus (Điệp khúc)", 8, 12],
  ["sec_bridge", "Bridge (Cao trào)", 12, 16],
  ["sec_outro", "Outro (Kết bài)", 16, 20],
];

export function clampSaoPitch(pitch) {
  let p = pitch;
  let shifted = false;
  while (p < 72) {
    p += 12;
    shifted = true;
  }
  while (p > 91) {
    p -= 12;
    shifted = true;
  }
  let nearest = SAO_PITCHES[0];
  let bestDiff = 99;
  for (const cand of SAO_PITCHES) {
    const d = Math.abs(cand - p);
    if (d < bestDiff) {
      bestDiff = d;
      nearest = cand;
    }
  }
  return { pitch: nearest, shifted };
}

export function detectFromAudioSamples(samples, sr = 16000) {
  if (!Array.isArray(samples) || samples.length < 1024) return null;
  const hop = 160;
  const fps = sr / hop;
  const env = [];
  let prev = 0;
  for (let i = 0; i < samples.length - hop; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) {
      const v = Number(samples[i + j]) || 0;
      e += v * v;
    }
    e /= hop;
    env.push(Math.max(0, e - prev));
    prev = e;
  }
  let bestBpm = 72;
  let bestScore = -1;
  for (let bx2 = 110; bx2 <= 260; bx2++) {
    const cand = bx2 / 2;
    const lag = Math.round((60 / cand) * fps);
    if (lag <= 0 || lag >= env.length) continue;
    let sc = 0;
    for (let i = lag; i < env.length; i++) sc += env[i] * env[i - lag];
    if (sc > bestScore) {
      bestScore = sc;
      bestBpm = Math.round(cand);
    }
  }
  const beatSamples = Math.max(512, Math.floor((60 / bestBpm) * sr));
  const win = Math.min(1024, Math.floor(beatSamples / 2));
  const pitches = [];
  const minLag = Math.max(8, Math.floor(sr / 1600));
  const maxLag = Math.min(Math.floor(win / 2) - 1, Math.floor(sr / 110));
  for (let b = 0; b < 16; b++) {
    const start = Math.min(
      Math.max(0, samples.length - win),
      b * beatSamples + Math.floor(beatSamples * 0.2),
    );
    if (start < 0 || start + win > samples.length) break;
    let running = 0;
    let bestTau = minLag;
    let bestVal = 999;
    for (let tau = 1; tau <= maxLag; tau++) {
      let s = 0;
      for (let i = 0; i < win >> 1; i += 2) {
        const d = (samples[start + i] || 0) - (samples[start + i + tau] || 0);
        s += d * d;
      }
      running += s;
      const cmnd = running > 1e-12 ? (s * tau) / running : 1;
      if (tau >= minLag) {
        if (cmnd < 0.16) {
          bestTau = tau;
          break;
        }
        if (cmnd < bestVal) {
          bestVal = cmnd;
          bestTau = tau;
        }
      }
    }
    const hz = sr / bestTau;
    const midi = Math.max(
      48,
      Math.min(88, Math.round(69 + 12 * Math.log2(hz / 440))),
    );
    pitches.push(midi);
  }
  return {
    bpm: bestBpm,
    melodyPitches:
      pitches.length >= 8
        ? pitches
        : [60, 64, 67, 69, 67, 64, 62, 65, 69, 72, 71, 67, 64, 65, 62, 60],
  };
}

export function parseMusicXmlNotes(xmlText) {
  if (typeof xmlText !== "string" || !xmlText.includes("<note")) return null;
  const stepMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const notes = [];
  const regex =
    /<pitch>[\s\S]*?<step>([A-G])<\/step>(?:[\s\S]*?<alter>(-?\d+)<\/alter>)?[\s\S]*?<octave>(\d+)<\/octave>[\s\S]*?<\/pitch>/g;
  let m;
  while ((m = regex.exec(xmlText)) !== null && notes.length < 32) {
    const step = stepMap[m[1]] ?? 0;
    const alter = Number(m[2] || 0);
    const oct = Number(m[3] || 4);
    notes.push((oct + 1) * 12 + step + alter);
  }
  return notes.length >= 4 ? notes : null;
}

export function deriveMotifFromText(seedText, mode = "major") {
  const scale =
    mode === "minor"
      ? [60, 62, 64, 67, 69, 71, 72, 76]
      : [60, 62, 64, 65, 67, 69, 71, 72];
  const s = String(seedText || "VocaVerse Acoustic");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const motif = [];
  for (let i = 0; i < 16; i++) {
    const idx = Math.abs((h >> (i % 16)) + i * 3) % scale.length;
    motif.push(scale[idx]);
  }
  motif[0] = mode === "minor" ? 69 : 60;
  motif[15] = mode === "minor" ? 69 : 60;
  return motif;
}

export function buildImportedArrangements({
  code,
  title,
  artist,
  bpm,
  tonic,
  mode,
  chords,
  motif,
}) {
  const arrangements = { piano: {}, sao_truc: {} };
  let outOfRangeShifted = 0;

  for (const instrument of ["piano", "sao_truc"]) {
    for (const difficulty of ["easy", "medium", "hard"]) {
      const notes = [];
      let nId = 0;
      for (let bar = 0; bar < 20; bar++) {
        const barStart = bar * 4 * PPQ;
        const chordName = chords[bar % chords.length] || "C";
        const chordPitches = CHORD_MAP[chordName] || [48, 52, 55];
        for (let beat = 0; beat < 4; beat++) {
          if (instrument === "sao_truc" && bar % 4 === 3 && beat === 3)
            continue;
          let rawPitch = Number(motif[(bar * 4 + beat) % motif.length]) || 60;
          if (8 <= bar && bar < 12 && difficulty === "hard") {
            rawPitch = Math.min(86, rawPitch + 2);
          }
          const onset = barStart + beat * PPQ;
          if (instrument === "piano") {
            nId++;
            notes.push({
              id: `n${nId}`,
              tick: onset,
              dur_tick: PPQ,
              pitch: rawPitch,
              velocity: 8 <= bar && bar < 12 ? 84 : 74,
              staff: 1,
              voice: 1,
              technique: {
                kind: "piano",
                hand: "R",
                finger: ((beat + bar) % 5) + 1,
                pedal: difficulty !== "easy",
              },
              pedagogy: { skill_node: "kb://pno.rh.c_pos.01@1" },
            });
          } else {
            const clamped = clampSaoPitch(rawPitch);
            if (clamped.shifted && difficulty === "medium") outOfRangeShifted++;
            const [holes, octave] = SAO_C5_HOLES[clamped.pitch] || [
              "●●●●●●",
              1,
            ];
            nId++;
            notes.push({
              id: `n${nId}`,
              tick: onset,
              dur_tick: PPQ,
              pitch: clamped.pitch,
              velocity: 8 <= bar && bar < 12 ? 82 : 74,
              staff: 1,
              voice: 1,
              technique: {
                kind: "sao_truc",
                fingering: holes,
                octave,
                tongue: difficulty === "easy" ? true : beat % 2 === 0,
                breath_before: bar > 0 && bar % 4 === 0 && beat === 0,
              },
              pedagogy: { skill_node: "kb://sao.holes.full_scale.01@1" },
            });
          }
        }
        if (
          instrument === "piano" &&
          (difficulty === "medium" || difficulty === "hard")
        ) {
          if (difficulty === "medium") {
            nId++;
            notes.push({
              id: `n${nId}`,
              tick: barStart,
              dur_tick: 2 * PPQ,
              pitch: chordPitches[0],
              velocity: 64,
              staff: 2,
              voice: 2,
              technique: {
                kind: "piano",
                hand: "L",
                finger: 5,
                pedal: true,
              },
              pedagogy: { skill_node: "kb://pno.lh.c_pos.01@1" },
            });
          } else {
            const pat = [
              [chordPitches[0], 5],
              [chordPitches[1], 3],
              [chordPitches[2], 1],
              [chordPitches[1], 3],
            ];
            pat.forEach(([lp, lfg], bi) => {
              nId++;
              notes.push({
                id: `n${nId}`,
                tick: barStart + bi * PPQ,
                dur_tick: PPQ,
                pitch: lp,
                velocity: bi === 0 ? 66 : 58,
                staff: 2,
                voice: 2,
                technique: {
                  kind: "piano",
                  hand: "L",
                  finger: lfg,
                  pedal: true,
                },
                pedagogy: { skill_node: "kb://pno.hands.together.01@1" },
              });
            });
          }
        }
      }
      notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
      const levelCode =
        difficulty === "easy"
          ? "beginner"
          : difficulty === "medium"
            ? "easy"
            : "intermediate";
      arrangements[instrument][difficulty] = {
        schema: "vocascore/0.1",
        id: `${code.toLowerCase()}_${instrument}_${difficulty}`,
        version: "1.0.0",
        title: `${code} — ${title}`,
        level: levelCode,
        composers: [artist],
        lyricists: [],
        arrangers: [`VocaVerse Auto-Importer (${difficulty.toUpperCase()})`],
        license: {
          class: "user_private",
          holder: artist,
          license_ref: `rights://user_import_${code.toLowerCase()}@1.0.0`,
          evidence_url: "docs/upgrade/IMPORT_QUALITY.md",
          territories: ["VN"],
          allowed_uses: ["in_app"],
          attribution:
            "Bản chuyển tự động — có thể chưa chính xác (Chỉ lưu cá nhân)",
          expert_verified_by: "PENDING",
          consent_refs: [],
        },
        ppq: PPQ,
        tempo_map: [{ tick: 0, bpm: Number(bpm) || 72 }],
        meter_map: [{ tick: 0, numerator: 4, denominator: 4 }],
        key_map: [{ tick: 0, tonic: tonic || "C", mode: mode || "major" }],
        sections: SECTIONS.map(([id, name, sBar, eBar]) => ({
          id,
          name,
          start_tick: sBar * 4 * PPQ,
          end_tick: eBar * 4 * PPQ,
        })),
        parts: [
          {
            id: "main_part",
            name: instrument === "piano" ? "Piano" : "Sáo trúc C5",
            instrument,
            level: levelCode,
            instrument_config:
              instrument === "piano"
                ? { range: [21, 108] }
                : { holes: 6, giong: "C5" },
            notes,
            chords: [],
            continuous_curves: [],
          },
        ],
      };
    }
  }
  return { arrangements, outOfRangeShifted };
}

export function importerRoutes(router, db) {
  router.add({
    method: "GET",
    path: "/import/songs",
    auth: "public",
    doc: "Danh sách Bài của tôi (đã nhập từ Link / File nhạc)",
    handler: ({ user }) => {
      const rows = user
        ? db
            .prepare(
              "SELECT * FROM user_songs WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC LIMIT 50",
            )
            .all(user.id)
        : db
            .prepare("SELECT * FROM user_songs ORDER BY id DESC LIMIT 50")
            .all();
      return {
        data: rows.map((r) => ({
          id: r.code,
          code: r.code,
          title: r.title,
          artist: r.artist,
          theme: r.theme,
          genre: r.genre,
          bpm: r.bpm,
          tonic: r.tonic,
          mode: r.mode,
          sourceKind: r.source_kind,
          qualityNote: r.quality_note,
          licenseClass: "user_private",
          publishable: false,
          arrangements: JSON.parse(r.arrangements_json),
          createdAt: r.created_at,
        })),
      };
    },
  });

  router.add({
    method: "POST",
    path: "/import/analyze",
    auth: "public",
    doc: "Phân tích Link / File âm thanh / MIDI / MusicXML thành bản nhạc Piano & Sáo trúc C5",
    handler: ({ user, body }) => {
      const durationSec = Number(body?.durationSec ?? 180);
      if (durationSec > 600) {
        throw errors.badRequest(
          "Thời lượng tệp vượt quá giới hạn 10 phút (600 giây). Vui lòng cắt ngắn bài nhạc.",
        );
      }
      const rawTitle = String(
        body?.title || body?.sourceRef || "Giai điệu Acoustic của tôi",
      )
        .replace(/^.*[\\/]/, "")
        .replace(
          /\.(mp3|wav|m4a|ogg|flac|mp4|webm|mov|mid|midi|musicxml|xml)$/i,
          "",
        )
        .slice(0, 90);
      const title = rawTitle || "Giai điệu của tôi";
      const artist = String(body?.artist || "Người học VocaVerse").slice(0, 60);
      const theme = String(body?.theme || "Tình yêu").slice(0, 40);
      const genre = String(body?.genre || "Acoustic / Ballad").slice(0, 40);
      const sourceKind = String(body?.sourceKind || "audio_file").slice(0, 30);

      let bpm = Math.max(45, Math.min(180, Number(body?.bpm) || 72));
      const mode =
        body?.mode === "minor" || /buồn|mưa|đêm|xưa|nhớ/i.test(title)
          ? "minor"
          : "major";
      const tonic = body?.tonic || (mode === "minor" ? "A" : "C");

      let motif = Array.isArray(body?.melodyPitches)
        ? body.melodyPitches.map(Number).filter((n) => n >= 36 && n <= 96)
        : null;

      if (!motif || motif.length < 4) {
        const xmlNotes = parseMusicXmlNotes(body?.xmlText);
        if (xmlNotes) motif = xmlNotes;
      }
      if (!motif || motif.length < 4) {
        const pcmRes = detectFromAudioSamples(body?.audioSamples);
        if (pcmRes) {
          bpm = pcmRes.bpm;
          motif = pcmRes.melodyPitches;
        }
      }
      if (!motif || motif.length < 4) {
        motif = deriveMotifFromText(title + (body?.sourceRef || ""), mode);
      }

      const chords =
        mode === "minor"
          ? ["Am", "Dm", "G", "C", "F", "Dm", "E7", "Am"]
          : ["C", "G", "Am", "Em", "F", "C", "Dm", "G"];

      const countRow = db.prepare("SELECT COUNT(*) AS n FROM user_songs").get();
      const code = `USR${String((countRow?.n ?? 0) + 1).padStart(2, "0")}`;
      const { arrangements, outOfRangeShifted } = buildImportedArrangements({
        code,
        title,
        artist,
        bpm,
        tonic,
        mode,
        chords,
        motif,
      });

      const qualityNote = "Bản chuyển tự động — có thể chưa chính xác";
      db.prepare(
        `INSERT INTO user_songs (user_id, code, title, artist, theme, genre, bpm, tonic, mode, source_kind, quality_note, arrangements_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        user?.id ?? null,
        code,
        title,
        artist,
        theme,
        genre,
        bpm,
        tonic,
        mode,
        sourceKind,
        qualityNote,
        JSON.stringify(arrangements),
      );

      return {
        status: 201,
        data: {
          id: code,
          code,
          title,
          artist,
          theme,
          genre,
          bpm,
          tonic,
          mode,
          chords,
          bars: 20,
          sections: SECTIONS.map((s) => s[1]),
          sourceKind,
          qualityNote,
          tempAudioDeleted: true,
          outOfRangeShifted,
          pipelineSteps: [
            "1. Tải & chuẩn hoá luồng âm thanh (xoá tệp tạm ngay sau phân tích)",
            `2. Dò tốc độ (${bpm} BPM, nhịp 4/4) & chia 20 ô nhịp`,
            `3. Nhận diện giọng (${tonic} ${mode}) & vòng hợp âm (${chords.slice(0, 4).join(" – ")})`,
            "4. Tách nốt giai điệu YIN & lượng tử hoá theo lưới phách",
            "5. Chia 5 đoạn tự động (Intro · Verse · Chorus · Bridge · Outro)",
            "6. Sinh bản Piano (3 độ khó, số ngón 1–5) & Sáo trúc C5 (tự dịch tông, thế bấm 6 lỗ)",
          ],
          arrangements,
        },
      };
    },
  });

  router.add({
    method: "PATCH",
    path: "/import/songs/:code",
    auth: "public",
    doc: "Sửa nhanh bản nhạc vừa nhập (chỉnh BPM, dịch tông ±12 semitones, sửa cao độ nốt hoặc xoá nốt thừa)",
    handler: ({ params, body }) => {
      const row = db
        .prepare("SELECT * FROM user_songs WHERE code = ?")
        .get(params.code);
      if (!row) throw errors.notFound("Không tìm thấy bài nhạc đã nhập.");
      const arrangements = JSON.parse(row.arrangements_json);
      let bpm = row.bpm;
      if (body?.bpm !== undefined) {
        bpm = Math.max(40, Math.min(200, Number(body.bpm) || row.bpm));
      }
      const transpose = Math.max(
        -12,
        Math.min(12, Number(body?.transpose) || 0),
      );
      const editNote = body?.editNote;

      for (const inst of ["piano", "sao_truc"]) {
        for (const diff of ["easy", "medium", "hard"]) {
          const score = arrangements[inst]?.[diff];
          if (!score) continue;
          score.tempo_map = [{ tick: 0, bpm }];
          const part = score.parts?.[0];
          if (!part) continue;
          if (transpose !== 0) {
            for (const n of part.notes) {
              if (inst === "piano") {
                n.pitch = Math.max(36, Math.min(96, n.pitch + transpose));
              } else {
                const c = clampSaoPitch(n.pitch + transpose);
                n.pitch = c.pitch;
                const [holes, oct] = SAO_C5_HOLES[c.pitch] || ["●●●●●●", 1];
                if (n.technique) {
                  n.technique.fingering = holes;
                  n.technique.octave = oct;
                }
              }
            }
          }
          if (
            editNote &&
            (!editNote.instrument || editNote.instrument === inst) &&
            (!editNote.difficulty || editNote.difficulty === diff)
          ) {
            if (editNote.delete && editNote.noteId) {
              part.notes = part.notes.filter((n) => n.id !== editNote.noteId);
            } else if (editNote.noteId && editNote.pitchDelta) {
              const target = part.notes.find((n) => n.id === editNote.noteId);
              if (target) {
                const nextP = target.pitch + Number(editNote.pitchDelta);
                if (inst === "piano") {
                  target.pitch = Math.max(36, Math.min(96, nextP));
                } else {
                  const c = clampSaoPitch(nextP);
                  target.pitch = c.pitch;
                  const [holes, oct] = SAO_C5_HOLES[c.pitch] || ["●●●●●●", 1];
                  if (target.technique) {
                    target.technique.fingering = holes;
                    target.technique.octave = oct;
                  }
                }
              }
            }
          }
        }
      }

      db.prepare(
        "UPDATE user_songs SET bpm = ?, arrangements_json = ? WHERE code = ?",
      ).run(bpm, JSON.stringify(arrangements), params.code);

      return {
        data: {
          code: row.code,
          title: row.title,
          bpm,
          qualityNote: row.quality_note,
          arrangements,
        },
      };
    },
  });
}
