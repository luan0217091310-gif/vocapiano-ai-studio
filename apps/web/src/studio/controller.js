import { TutorSession } from "../../../../web-engines/practice/src/session.ts";
import { parseVocaScore } from "../../../../web-engines/practice/src/load.ts";
import {
  parseSafetyParams,
  parseThresholds,
  parseLessonConfig,
} from "../../../../web-engines/practice/src/config.ts";
import {
  parseCueContextRules,
  parseCueLibrary,
} from "../../../../web-engines/practice/src/cues.ts";
import {
  clipFromScore,
  buildClipIndex,
} from "../../../../web-engines/practice/src/clip.ts";
import { cutBars } from "../../../../web-engines/practice/src/gen.ts";
import {
  beatMsAt,
  tickToMs,
  barOfTick,
  msToTick,
} from "../../../../web-engines/practice/src/timing.ts";
import {
  cleanPerformance,
  toEvents,
  START_MS,
} from "../../../../web-engines/practice/testkit/synth.ts";
import { decodeMidi, readHistory, saveAttempt } from "../../model.mjs";
import { readProductState, saveLastLesson } from "../productStore.js";
import { reportPractice } from "./reportPractice.js";
import { createInstrumentAudio } from "./audio.js";
import {
  createMicPitchDetector,
  createNoteTracker,
  createSimulatedMic,
} from "./mic.js";
import { barAccuracy, buildErrorDrill, DRILL_SPEED } from "./drill.js";
import { POSTURE_MS, REST_MS } from "./safety.js";

export class StudioController {
  listeners = new Set();
  state = {
    loading: true,
    error: "",
    lesson: null,
    lessons: [],
    status: "ready",
    countdown: 3,
    speed: 100,
    from: 1,
    to: 8,
    loop: false,
    mode: "learn",
    practice: "realtime",
    noteStates: {},
    active: {},
    feedback: "Mình cùng tập từng câu, chậm rãi và thật chắc nhé.",
    report: null,
    history: [],
    devices: [],
    device: "",
    midiStatus: "idle",
    volume: true,
    velocity: 80,
    speech: false,
    speaking: false,
    offset: 0,
    waiting: false,
    held: [],
    question: null,
    focusGuard: false,
    // Micro: off | requesting | on | sim | denied | unsupported
    micStatus: "off",
    micLevel: 0,
    micPitch: null,
    noiseFloor: 0,
    calibrating: false,
    // An toàn D-40: thẻ tư thế trước bài và đồng hồ nghỉ.
    posture: false,
    rest: null,
    // Phản hồi cao độ tức thì: { pitch, expected, idx, diff, at }
    pitchHint: null,
    barStats: [],
    drill: null,
    // Metronome AudioContext & chế độ tai nghe (P1-04)
    headphones: false,
    beatPulse: 0,
    beatAccent: false,
    // Kho 36 bài hát trọn bài test nội bộ & Bài của tôi (nhập nhạc tự động)
    localSongs: [],
    userSongs: [],
    songDifficulty: "medium",
    handFilter: "both",
  };
  synth = null;
  mic = null;
  micStream = null;
  tracker = null;
  postureMs = globalThis.document ? POSTURE_MS : 0;
  postureSeen = new Set();
  postureSkip = null;
  run = null;
  clip = null;
  index = null;
  session = null;
  sessionKey = "";
  audio = null;
  manualKeys = new Map();
  midi = null;
  port = null;
  raf = null;
  storage = null;
  constructor() {
    try {
      this.storage = globalThis.localStorage;
    } catch {
      // Trình duyệt chặn localStorage (chế độ riêng tư): chạy không lưu lịch sử.
    }
  }
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.state;
  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  async init() {
    const json = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Không tải được ${url}`);
      return r.json();
    };
    try {
      const [packages, safety, thresholds, lessons, rules, cues, chart] =
        await Promise.all(
          [
            "/api/lessons",
            "/practice/data/safety_params.json",
            "/practice/config/thresholds.json",
            "/practice/config/lessons.json",
            "/practice/config/cue_context.json",
            "/practice/data/cues.json",
            "/api/flute-chart",
          ].map(json),
        );
      this.data = {
        th: parseThresholds(thresholds, parseSafetyParams(safety)),
        lessons: parseLessonConfig(lessons),
        cues: parseCueLibrary(cues, parseCueContextRules(rules)),
      };
      this.chart = chart;
      const loaded = packages.map((pkg) => ({
        ...pkg,
        score: parseVocaScore(pkg.score),
      }));
      let localSongs = [];
      let userSongs = [];
      try {
        const [lsRes, usRes] = await Promise.all([
          fetch("/api/local-songs").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/v1/import/songs").then((r) => (r.ok ? r.json() : null)),
        ]);
        localSongs = lsRes?.songs ?? [];
        userSongs = usRes?.data ?? [];
      } catch {
        /* fallback khi chạy test đơn vị không bật endpoint phụ */
      }
      this.set({
        lessons: loaded,
        localSongs,
        userSongs,
        loading: false,
        history: readHistory(this.storage),
      });
      const params = new URLSearchParams(globalThis.location?.search ?? "");
      const requested = params.get("lesson") ?? readProductState().lastLesson;
      const reqInst = params.get("inst");
      const reqDiff = params.get("diff");
      const matchedCatalog =
        localSongs.find((s) => s.id === requested) ??
        userSongs.find((s) => s.id === requested || s.code === requested) ??
        (requested?.startsWith("TS") && localSongs.length > 0
          ? localSongs[reqInst === "sao_truc" && localSongs.length > 1 ? 1 : 0]
          : null);
      if (matchedCatalog) {
        this.selectCatalogSong(
          matchedCatalog,
          reqInst || "piano",
          reqDiff || "medium",
        );
      } else {
        this.selectLesson(
          loaded.find((p) => p.id === requested) ??
            loaded.find((p) => p.id === "PN06") ??
            loaded[0],
        );
      }
    } catch (err) {
      this.set({ loading: false, error: err.message });
    }
  }
  selectLesson(lesson) {
    this.cancel();
    this.full = clipFromScore(lesson.score);
    this.sessionKey = "";
    saveLastLesson(lesson.id);
    this.set({
      lesson,
      from: this.full.bars[0],
      to: this.full.bars[1],
      status: "ready",
      report: null,
      noteStates: {},
      mode: "learn",
      held: [],
      barStats: [],
      drill: null,
      pitchHint: null,
      question: null,
      feedback:
        lesson.instrument === "sao_truc"
          ? "Mình là Gia Phong. Nghe mẫu trước, rồi bật micro để mình nghe bạn thổi nhé."
          : "Chào bạn, mình là Minh An. Cùng nghe mẫu, rồi luyện từng câu nhé.",
    });
    this.synth?.setInstrument(lesson.instrument);
    this.updateClip();
  }
  selectCatalogSong(song, instrument = null, difficulty = null) {
    if (!song?.arrangements) return;
    const inst =
      instrument ||
      (this.state.lesson?.instrument === "sao_truc" ? "sao_truc" : "piano");
    const diff = ["easy", "medium", "hard"].includes(difficulty)
      ? difficulty
      : this.state.songDifficulty || "medium";
    const rawScore =
      song.arrangements?.[inst]?.[diff] ??
      song.arrangements?.[inst]?.medium ??
      song.arrangements?.piano?.medium;
    if (!rawScore) return;
    const code = song.id || song.code;
    const parsedScore = parseVocaScore(rawScore);
    this.set({ songDifficulty: diff, handFilter: "both" });
    this.selectLesson({
      id: code,
      title: `${code} — ${song.title}`,
      level: rawScore.level || "easy",
      instrument: inst,
      score: parsedScore,
      catalogSong: song,
      qualityNote: song.qualityNote || null,
    });
  }
  setArrangement(instrument, difficulty) {
    if (this.state.lesson?.catalogSong) {
      this.selectCatalogSong(
        this.state.lesson.catalogSong,
        instrument || this.state.lesson.instrument,
        difficulty || this.state.songDifficulty,
      );
    }
  }
  registerImportedSong(song, instrument = "piano", difficulty = "medium") {
    const next = [
      song,
      ...this.state.userSongs.filter((x) => x.code !== song.code),
    ];
    this.set({ userSongs: next });
    this.selectCatalogSong(song, instrument, difficulty);
  }
  jumpToSection(fromBar, toBar) {
    if (this.run) this.cancel();
    this.configure({ from: fromBar, to: toBar });
  }
  configure(patch) {
    if (this.run) return;
    const safe = { ...patch };
    if (safe.speed !== undefined)
      safe.speed = Math.min(150, Math.max(25, Number(safe.speed) || 100));
    if (safe.mode === "exam") {
      safe.practice = "realtime";
      safe.loop = false;
    }
    if (this.state.mode === "exam" && safe.practice === "wait")
      safe.mode = "learn";
    this.set(safe);
    this.sessionKey = "";
    this.updateClip();
  }
  updateClip() {
    if (!this.full) return;
    const from = Math.max(
      this.full.bars[0],
      Math.min(this.full.bars[1], Number(this.state.from) || 1),
    );
    const to = Math.max(
      from,
      Math.min(this.full.bars[1], Number(this.state.to) || from),
    );
    const cut = cutBars(this.full, from, to);
    // Thay tempo của bản dùng luyện, không thay nốt/ngón hoặc dữ liệu nguồn. Hỗ trợ 50–125%.
    this.clip = {
      ...cut,
      baseTempo: cut.baseTempo.map((t) => ({
        ...t,
        bpm: (t.bpm * this.state.speed) / 100,
      })),
      tempoPct: 100,
    };
    this.index = buildClipIndex(this.clip, this.data.th.index);
    this.set({ from, to, noteStates: {}, report: null });
  }
  async ensureAudio() {
    try {
      if (!this.audio) this.audio = new AudioContext();
      if (!this.synth)
        this.synth = createInstrumentAudio(this.audio, {
          instrument: this.state.lesson?.instrument,
        });
      await this.audio.resume();
    } catch {
      this.set({
        error: "Không mở được âm thanh. Bạn vẫn có thể xem nhạc và dùng MIDI.",
      });
    }
  }
  soundOn(pitch, velocity = 80) {
    if (!this.state.volume || !this.synth) return;
    this.synth.noteOn(pitch, velocity);
  }
  soundOff(pitch) {
    this.synth?.noteOff(pitch);
  }
  silence() {
    this.synth?.allOff();
    this.manualKeys.clear();
    this.set({ active: {} });
  }
  speak(text) {
    this.set({ feedback: text });
    if (
      this.state.speech &&
      "speechSynthesis" in globalThis &&
      !(this.run && this.state.mode === "exam")
    ) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "vi-VN";
      u.rate = 1;
      u.onstart = () => this.set({ speaking: true });
      u.onend = u.onerror = () => this.set({ speaking: false });
      speechSynthesis.speak(u);
    }
  }
  toggleSpeech() {
    if ("speechSynthesis" in globalThis) speechSynthesis.cancel();
    this.set({ speech: !this.state.speech, speaking: false });
  }
  consume(result) {
    let patch = null;
    for (const h of result.hot)
      if (h.idx !== null) {
        patch ??= { ...this.state.noteStates };
        patch[h.idx] =
          h.timing && h.timing !== "on_time" && h.kind === "hit"
            ? "timing"
            : h.kind;
      }
    if (patch) this.set({ noteStates: patch });
    if (this.state.practice !== "wait") {
      const spoken = result.spoken.filter((s) => s.text).map((s) => s.text);
      if (spoken.length) this.speak(spoken.at(-1));
    }
  }
  elapsed() {
    if (!this.run) return 0;
    if (this.state.status === "paused") return this.run.pausedTime;
    if (this.run.pending && this.state.waiting)
      return this.groups[this.run.group].time + this.run.countIn;
    return performance.now() - this.run.epoch;
  }
  musicTime() {
    return Math.max(0, this.elapsed() - (this.run?.countIn ?? 0));
  }
  progress() {
    return this.run
      ? this.musicTime()
      : this.state.status === "finished"
        ? tickToMs(this.index.tm, this.clip.endTick)
        : 0;
  }
  activeNote() {
    const t = this.progress();
    return (
      this.index?.expected.find(
        (e) => e.onMs <= t + 20 && e.onMs + e.durMs > t,
      ) ??
      this.index?.expected.find((e) => e.onMs > t) ??
      this.index?.expected.at(-1)
    );
  }
  async start(kind = "practice", wrong = false, repeating = false) {
    if (!this.clip || this.run || this.state.status === "starting") return;
    if (this.state.rest) return;
    this.set({ status: "starting", error: "" });
    await this.ensureAudio();
    // Thẻ tư thế 3 giây trước lượt tự luyện đầu tiên của mỗi bài (D-40).
    if (kind === "practice" && !repeating && this.postureMs > 0) {
      const id = this.state.lesson.id;
      if (!this.postureSeen.has(id)) {
        this.postureSeen.add(id);
        this.set({ posture: true });
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, this.postureMs);
          this.postureSkip = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        this.postureSkip = null;
        const stopped = this.state.status !== "starting";
        this.set({ posture: false });
        if (stopped) return;
      }
    }
    const source =
      kind === "demo"
        ? "demo"
        : this.micOn()
          ? "mic"
          : this.port
            ? "midi"
            : "keyboard";
    const key = [
      this.state.lesson.id,
      source,
      this.state.mode,
      this.state.practice,
      this.state.speed,
      this.state.from,
      this.state.to,
    ].join(":");
    if (key !== this.sessionKey) {
      this.session = new TutorSession({
        score: this.state.lesson.score,
        data: this.data,
        mode: this.state.mode === "exam" ? "retention" : "practice",
        clock: this.state.practice === "wait" ? "free" : "metronome",
      });
      this.sessionKey = key;
    }
    const beat = beatMsAt(this.index.tm, this.clip.meter_map, 0),
      countIn = repeating ? 0 : beat * 3;
    const events = [];
    if (kind === "demo") {
      const perf = cleanPerformance(this.index, 100);
      if (wrong) {
        const n = perf.notes.find((n) => n.exp.note.tick > 0) ?? perf.notes[0];
        n.pitch = Math.min(127, n.pitch + 2);
      }
      events.push(
        ...toEvents(perf).map((ev) => ({
          ...ev,
          t: ev.t - START_MS + countIn,
        })),
      );
    }
    this.session.startAttempt({ clip: this.clip, startMs: countIn });
    this.groups = [...new Set(this.index.expected.map((e) => e.onMs))].map(
      (t) => ({
        time: t,
        pitches: new Set(
          this.index.expected
            .filter((e) => e.onMs === t)
            .map((e) => e.note.pitch),
        ),
      }),
    );
    this.run = {
      kind,
      wrong,
      source,
      events,
      cursor: 0,
      epoch: performance.now(),
      countIn,
      beat,
      lastBeat: -1,
      group: 0,
      pending: null,
      end:
        countIn +
        tickToMs(this.index.tm, this.clip.endTick) +
        (this.state.loop ? 0 : 700),
    };
    this.set({
      status: repeating ? "playing" : "countdown",
      countdown: 3,
      noteStates: {},
      report: null,
      held: [],
      question: null,
      waiting: false,
      feedback:
        kind === "demo"
          ? wrong
            ? "Mẫu thử có một nốt sai. Chạy lại để xem gia sư nhận ra lỗi lặp lại."
            : "Nghe giai điệu và quan sát cách các nốt nối với nhau nhé."
          : this.state.mode === "exam"
            ? "Bài kiểm tra: mình sẽ giữ góp ý đến cuối lượt. Bạn cứ bình tĩnh chơi nhé."
            : this.state.practice === "wait"
              ? "Mình đợi bạn chơi đúng từng nốt. Chế độ này không chấm nhịp."
              : "Chuẩn bị nhé. Mình cùng bắt đầu sau ba phách.",
    });
    this.raf = requestAnimationFrame(this.frame);
  }
  frame = () => {
    if (!this.run || this.state.status === "paused") return;
    let t = performance.now() - this.run.epoch;
    const run = this.run;
    if (t < run.countIn) {
      const b = Math.floor(t / run.beat);
      if (b !== run.lastBeat) {
        run.lastBeat = b;
        const silentMic = this.micOn() && !this.state.headphones;
        this.set({
          countdown: 3 - b,
          beatPulse: b + 1,
          beatAccent: b === 0,
        });
        if (this.state.volume && !silentMic) this.synth?.click(b === 0);
      }
    } else {
      if (this.state.status !== "playing") this.set({ status: "playing" });
      // Nhịp Metronome theo đồng hồ trong lúc chơi (tự chuyển sang nháy sáng khi bật Micro không tai nghe - P1-04)
      if (this.state.practice !== "wait") {
        const b = Math.floor(t / run.beat);
        if (b !== run.lastBeat) {
          run.lastBeat = b;
          const accent = (b - 3) % 4 === 0;
          const silentMic = this.micOn() && !this.state.headphones;
          this.set({ beatPulse: b + 1, beatAccent: accent });
          if (this.state.volume && !silentMic && run.kind === "practice") {
            this.synth?.click(accent);
          }
        }
      }
      if (run.kind === "practice" && this.state.practice === "wait") {
        const group = this.groups[run.group];
        if (group && t >= group.time + run.countIn) {
          const fixed = group.time + run.countIn;
          run.epoch += t - fixed;
          t = fixed;
          if (!run.pending) run.pending = new Set(group.pitches);
          if (!this.state.waiting) this.set({ waiting: true });
        }
      }
      while (
        this.run &&
        run.cursor < run.events.length &&
        run.events[run.cursor].t <= t
      )
        this.send(run.events[run.cursor++]);
      this.consume(this.session.tick(t));
      if (t >= run.end) {
        const loop = this.state.loop && this.state.mode !== "exam";
        const kind = run.kind;
        this.finish();
        if (loop) this.start(kind, run.wrong, true);
        return;
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  send(event) {
    if (event.type === "on") {
      this.soundOn(event.pitch, event.velocity);
      this.set({
        active: { ...this.state.active, [event.pitch]: event.velocity },
      });
    }
    if (event.type === "off") {
      this.soundOff(event.pitch);
      const active = { ...this.state.active };
      delete active[event.pitch];
      this.set({ active });
    }
    if (!this.run || !["playing", "countdown"].includes(this.state.status))
      return;
    if (event.type === "on" && this.run.source !== "demo")
      this.hint(event.pitch);
    this.consume(this.session.push(event));
    if (event.type === "on" && this.run.pending?.has(event.pitch)) {
      this.run.pending.delete(event.pitch);
      if (!this.run.pending.size) {
        this.run.group++;
        this.run.pending = null;
        this.set({ waiting: false });
      }
    }
  }
  press(key, pitch) {
    if (
      this.manualKeys.has(key) ||
      this.state.status === "paused" ||
      this.state.status === "countdown" ||
      this.run?.source === "demo" ||
      this.run?.source === "midi" ||
      this.run?.source === "mic"
    )
      return;
    if (!this.audio) this.ensureAudio();
    this.manualKeys.set(key, pitch);
    this.send({
      type: "on",
      pitch,
      velocity: this.state.velocity,
      t: this.run ? this.elapsed() + this.state.offset : 0,
    });
  }
  release(key) {
    const pitch = this.manualKeys.get(key);
    if (pitch === undefined) return;
    this.manualKeys.delete(key);
    this.send({
      type: "off",
      pitch,
      t: this.run ? this.elapsed() + this.state.offset : 0,
    });
  }
  pause(focus = false) {
    if (!this.run || this.state.status === "paused") return;
    const t = this.elapsed();
    for (const p of Object.keys(this.state.active))
      this.session.push({ type: "off", pitch: Number(p), t });
    this.run.pausedTime = t;
    cancelAnimationFrame(this.raf);
    this.silence();
    if ("speechSynthesis" in globalThis) speechSynthesis.cancel();
    this.set({ status: "paused", focusGuard: focus, speaking: false });
  }
  resume() {
    if (!this.run || this.state.status !== "paused") return;
    if (this.run.source === "midi" && !this.port) {
      this.set({
        error:
          "Kết nối lại đàn MIDI trước khi tiếp tục, hoặc bỏ lượt để đổi đầu vào.",
      });
      return;
    }
    this.run.epoch = performance.now() - this.run.pausedTime;
    this.set({
      status: this.run.pausedTime < this.run.countIn ? "countdown" : "playing",
      focusGuard: false,
    });
    this.raf = requestAnimationFrame(this.frame);
  }
  finish() {
    if (!this.run) return;
    const run = this.run,
      t = this.elapsed();
    cancelAnimationFrame(this.raf);
    const report = this.session.endAttempt(t);
    this.run = null;
    this.silence();
    if (t < run.countIn) {
      this.sessionKey = "";
      this.set({ status: "ready" });
      return;
    }
    const waitPractice =
      this.state.practice === "wait" && run.kind === "practice";
    if (waitPractice) {
      report.detections = report.detections.filter((d) => d.aspect === "pitch");
      report.spoken = [];
      report.held = [];
      report.selfAssessPrompt = null;
      report.escalation = null;
    }
    const texts = report.spoken.filter((s) => s.text).map((s) => s.text);
    if (report.escalation?.text) texts.push(report.escalation.text);
    const row = {
      lesson: this.state.lesson.id,
      at: new Date().toISOString(),
      source: run.source,
      speed: this.state.speed,
      bars: [this.state.from, this.state.to],
      mode: this.state.mode,
      practice: this.state.practice,
      ...report.accuracy,
    };
    try {
      saveAttempt(this.storage, row);
      // Lượt tự luyện (không phải xem mẫu) được lưu vào tài khoản để tính XP, chuỗi ngày, huy hiệu.
      if (run.source !== "demo" && report.accuracy.notes > 0)
        reportPractice({
          lessonId: this.state.lesson.id,
          mode:
            this.state.mode === "exam"
              ? "exam"
              : this.state.practice === "wait"
                ? "wait"
                : "learn",
          accuracy: report.accuracy.correct / report.accuracy.notes,
          durationS: Math.max(1, Math.round((t - run.countIn) / 1000)),
        });
      this.set({ history: readHistory(this.storage) });
    } catch {
      this.set({
        error:
          "Trình duyệt không cho lưu lịch sử. Bạn vẫn xem được kết quả lượt này.",
      });
    }
    const barStats = barAccuracy(
      this.index.expected,
      this.state.noteStates,
      report.detections,
    );
    this.set({
      status: "finished",
      report,
      barStats,
      drill: buildErrorDrill(barStats),
      waiting: false,
      focusGuard: false,
      held: report.held,
      question: report.selfAssessPrompt,
    });
    this.speak(
      (waitPractice
        ? `Đã ghi nhận ${report.accuracy.correct}/${report.accuracy.notes} nốt khớp. Chế độ chờ không đánh giá nhịp.`
        : texts.at(-1)) ??
        (report.accuracy.correct === report.accuracy.notes
          ? "Các nốt đã khớp bản nhạc. Mình cùng giữ nhịp và độ ngân thật tự nhiên nhé."
          : "Đã ghi nhận lượt chơi. Mình cùng tập lại chỗ chưa chắc nhé."),
    );
  }
  cancel() {
    if (this.run) {
      cancelAnimationFrame(this.raf);
      this.session.endAttempt(this.elapsed());
      this.run = null;
    }
    this.sessionKey = "";
    this.silence();
    this.tracker?.flush(0);
    if ("speechSynthesis" in globalThis) speechSynthesis.cancel();
    this.set({
      status: "ready",
      focusGuard: false,
      speaking: false,
      posture: false,
    });
  }
  /** Sửa lỗi 1 chạm: khoanh đoạn yếu, bật lặp A–B, hạ tempo 70% và bắt đầu ngay. */
  async practiceDrill() {
    const drill = this.state.drill;
    if (!drill || this.run) return;
    this.configure({
      from: drill.from,
      to: drill.to,
      speed: drill.speed ?? DRILL_SPEED,
      mode: "learn",
      loop: true,
    });
    this.set({ drill, activeDrill: drill });
    this.speak(
      `Mình tập lại ô ${drill.from}${drill.to > drill.from ? `–${drill.to}` : ""} ở tốc độ ${drill.speed}% nhé. Chậm mà chắc.`,
    );
    await this.start("practice");
  }
  /** Ghi nhận lệch cao độ so với nốt kỳ vọng gần nhất (để báo "cao hơn"/"thấp hơn"). */
  hint(pitch) {
    const t = this.musicTime();
    const exp =
      this.index?.expected.find(
        (e) =>
          Math.abs(e.onMs - t) <= 250 || (e.onMs <= t && e.onMs + e.durMs > t),
      ) ?? this.activeNote();
    if (!exp) return;
    this.set({
      pitchHint: {
        pitch,
        expected: exp.note.pitch,
        idx: exp.idx,
        diff: pitch - exp.note.pitch,
        at: performance.now(),
      },
    });
  }
  skipPosture() {
    this.postureSkip?.();
  }
  /** Nút an toàn "Mỏi tay / Chóng mặt" (AP-6, D-40): dừng ngay, không lưu lượt, bắt đầu nghỉ. */
  fatigue() {
    this.postureSkip?.();
    this.cancel();
    this.set({
      rest: { started: Date.now(), until: Date.now() + REST_MS },
      posture: false,
    });
    this.speak(
      "Mình dừng lại nhé. Nghỉ ngơi một chút, sức khoẻ của bạn quan trọng nhất.",
    );
  }
  /** Kết thúc nghỉ: tự động khi hết giờ, hoặc sớm khi người lớn xác nhận đã ổn. */
  endRest(confirmed) {
    if (!this.state.rest) return;
    if (!confirmed && Date.now() < this.state.rest.until) return;
    this.set({ rest: null });
  }
  micOn() {
    return this.state.micStatus === "on" || this.state.micStatus === "sim";
  }
  micEvent = (event) => {
    if (this.run?.source !== "mic" || this.state.status !== "playing") return;
    this.send({ ...event, t: this.elapsed() + this.state.offset });
  };
  micPitch = (p) => {
    this.tracker?.push(p, p?.t ?? 0);
    const prev = this.state.micPitch;
    if (
      p?.midi !== prev?.midi ||
      Math.abs((p?.cents ?? 0) - (prev?.cents ?? 0)) >= 2
    )
      this.set({ micPitch: p ? { midi: p.midi, cents: p.cents } : null });
  };
  micLevel = (rms) => {
    const level = Math.min(1, Math.sqrt(rms) * 3);
    if (Math.abs(level - this.state.micLevel) > 0.03)
      this.set({ micLevel: level });
  };
  /** Bật micro chấm điểm. `simulate` dùng micro giả lập (test tự động, demo không cần quyền). */
  async enableMic({ simulate = false, cents = 0, semitones = 0 } = {}) {
    if (this.run || this.micOn()) return;
    this.tracker = createNoteTracker({ onEvent: this.micEvent });
    if (simulate) {
      this.mic = createSimulatedMic({
        expectedAt: () => {
          if (this.state.status !== "playing") return null;
          const t = this.musicTime();
          return (
            this.index?.expected.find(
              (e) => e.onMs <= t && e.onMs + e.durMs - 110 > t,
            )?.note ?? null
          );
        },
        onPitch: this.micPitch,
        onLevel: this.micLevel,
        cents,
        semitones,
      });
      this.set({ micStatus: "sim", error: "" });
      return;
    }
    if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
      this.set({
        micStatus: "unsupported",
        error: "Trình duyệt chưa hỗ trợ micro. Hãy thử Chrome hoặc Edge.",
      });
      return;
    }
    this.set({ micStatus: "requesting", error: "" });
    try {
      await this.ensureAudio();
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this.mic = await createMicPitchDetector(this.audio, this.micStream, {
        calibrationMs: 1000,
        onPitch: this.micPitch,
        onLevel: this.micLevel,
      });
      this.set({ micStatus: "on", calibrating: true });
      this.calibrationTimer = setTimeout(
        () =>
          this.set({
            calibrating: false,
            noiseFloor: this.mic?.gate.threshold ?? 0,
          }),
        1000,
      );
    } catch {
      this.micStream?.getTracks().forEach((tr) => tr.stop());
      this.micStream = null;
      this.set({
        micStatus: "denied",
        error:
          "Chưa được cấp quyền micro. Bạn vẫn luyện được bằng bàn phím hoặc MIDI.",
      });
    }
  }
  disableMic() {
    if (this.run?.source === "mic") this.cancel();
    clearTimeout(this.calibrationTimer);
    this.tracker?.flush(0);
    this.mic?.stop();
    this.micStream?.getTracks().forEach((tr) => tr.stop());
    this.mic = this.micStream = this.tracker = null;
    if (this.state.micStatus !== "off")
      this.set({
        micStatus: "off",
        micLevel: 0,
        micPitch: null,
        calibrating: false,
      });
  }
  /** Hiệu chuẩn ồn phòng: đo nền 1 giây trong im lặng. */
  calibrateMic() {
    if (!this.mic?.gate || this.state.calibrating || this.run) return;
    this.mic.gate.reset();
    this.set({ calibrating: true });
    this.calibrationTimer = setTimeout(
      () =>
        this.set({
          calibrating: false,
          noiseFloor: this.mic?.gate.threshold ?? 0,
        }),
      1000,
    );
  }
  retry() {
    const bar = this.state.report?.detections.find((d) => d.scoring)?.bar;
    if (!bar) return;
    this.configure({
      from: Math.max(1, bar - 1),
      to: Math.min(this.full.bars[1], bar + 1),
      speed: 60,
      mode: "learn",
    });
  }
  reveal() {
    const text = this.state.held
      .filter((s) => s.text)
      .map((s) => s.text)
      .join(" ");
    if (text) this.speak(text);
    this.set({ held: [], question: null });
  }
  currentBar() {
    return this.clip
      ? barOfTick(
          this.clip.originMeter,
          this.clip.ppq,
          this.clip.originTick + msToTick(this.index.tm, this.progress()),
        )
      : 1;
  }
  async connectMidi() {
    if (!navigator.requestMIDIAccess) {
      this.set({
        midiStatus: "unsupported",
        error:
          "Trình duyệt chưa hỗ trợ MIDI. Bạn có thể dùng bàn phím màn hình hoặc thử Chrome/Edge.",
      });
      return;
    }
    try {
      this.midi = await navigator.requestMIDIAccess({ sysex: false });
      this.midi.onstatechange = () => this.refreshMidi();
      this.refreshMidi();
    } catch {
      this.set({
        midiStatus: "denied",
        error:
          "Chưa được cấp quyền MIDI. Bạn vẫn có thể luyện bằng bàn phím màn hình.",
      });
    }
  }
  refreshMidi() {
    const devices = [...this.midi.inputs.values()]
      .filter((d) => d.state === "connected")
      .map((d) => ({ id: d.id, name: d.name }));
    if (
      this.port &&
      !devices.some((d) => d.id === this.port.id) &&
      this.run?.source === "midi"
    ) {
      this.pause(true);
      this.set({
        error:
          "Đàn đã ngắt kết nối. Kết nối lại trước khi tiếp tục, hoặc hủy lượt để đổi đầu vào.",
      });
    }
    const device = devices.some((d) => d.id === this.state.device)
      ? this.state.device
      : (devices[0]?.id ?? "");
    this.set({
      devices,
      device,
      midiStatus: devices.length ? "connected" : "empty",
    });
    this.selectDevice(device);
  }
  selectDevice(id) {
    if (this.port) this.port.onmidimessage = null;
    this.port = this.midi?.inputs.get(id) ?? null;
    this.set({ device: id });
    if (this.port)
      this.port.onmidimessage = (ev) => {
        if (this.run?.source !== "midi" || this.state.status !== "playing")
          return;
        const event = decodeMidi(ev.data, this.elapsed() + this.state.offset);
        if (event) this.send(event);
      };
  }
  destroy() {
    this.cancel();
    this.disableMic();
    if (this.midi) this.midi.onstatechange = null;
    if (this.port) this.port.onmidimessage = null;
    this.audio?.close();
  }
}
