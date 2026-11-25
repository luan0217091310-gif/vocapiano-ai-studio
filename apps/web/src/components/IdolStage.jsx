import {
  Check,
  ChevronRight,
  Focus,
  Maximize2,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRef } from "react";
import { useAnimation } from "../studio/useStudio.js";

// Concept vector gốc, không phải asset VRM. Thay nội dung bằng VRM renderer tại biên component này.
function MentorConcept({ controller: c, closeup, flute }) {
  const hand = useRef(),
    head = useRef();
  useAnimation(() => {
    const n = c.activeNote();
    const playing = c.state.status === "playing";
    if (hand.current)
      hand.current.style.transform = `translateX(${playing ? ((n?.note.pitch ?? 60) - 64) * 1.5 : 0}px)`;
    if (head.current)
      head.current.style.transform = `rotate(${playing ? Math.sin(c.progress() / 800) * 1.5 : 0}deg)`;
  });
  return (
    <svg
      className={`mentor-concept ${closeup ? "closeup" : ""}`}
      viewBox="0 0 480 560"
      role="img"
      aria-label={`${flute ? "Gia Phong" : "Minh An"} — concept minh họa, chưa phải model 3D`}
    >
      <defs>
        <linearGradient id="jacket" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#294357" />
          <stop offset=".5" stopColor="#142a39" />
          <stop offset="1" stopColor="#09151f" />
        </linearGradient>
        <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f5d4ba" />
          <stop offset=".7" stopColor="#d6a78c" />
          <stop offset="1" stopColor="#a5796e" />
        </linearGradient>
        <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#182831" />
          <stop offset=".5" stopColor="#293c43" />
          <stop offset="1" stopColor="#080f18" />
        </linearGradient>
        <linearGradient id="piano" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#243440" />
          <stop offset="1" stopColor="#080d14" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <ellipse
        cx="240"
        cy="505"
        rx="155"
        ry="24"
        fill="#00d8ec"
        opacity=".08"
      />
      <path
        d="M100 499Q106 369 164 335L207 316H272L318 339Q376 369 386 500"
        fill="url(#jacket)"
        stroke="#446578"
        strokeWidth="1"
      />
      <path d="M203 314L210 273H269L277 318L246 345Z" fill="url(#skin)" />
      <path
        d="M206 317L244 345L273 316L289 339L257 446L228 445L188 338Z"
        fill="#cad5d8"
      />
      <path
        d="M197 323L225 443L192 397L167 388L180 337Z"
        fill="#203948"
        stroke="#385364"
      />
      <path
        d="M280 323L255 443L297 396L316 389L302 337Z"
        fill="#152c3b"
        stroke="#385364"
      />
      <path d="M220 344L244 362L266 345L259 430H229Z" fill="#0d202b" />
      <g ref={head} style={{ transformOrigin: "240px 270px" }}>
        <ellipse cx="169" cy="214" rx="13" ry="25" fill="url(#skin)" />
        <ellipse cx="306" cy="214" rx="12" ry="25" fill="url(#skin)" />
        <path
          d="M171 161Q168 105 236 105Q302 109 307 170L299 245Q282 285 241 303Q204 287 182 250Z"
          fill="url(#skin)"
        />
        <path
          d="M169 218L157 172Q145 111 191 92Q180 72 229 80Q275 69 302 108Q331 126 310 208L298 228L290 169Q253 171 227 135Q206 174 176 179Z"
          fill="url(#hair)"
        />
        <path
          d="M171 159Q194 107 247 103M193 160Q209 109 261 113M242 138Q270 151 302 143"
          fill="none"
          stroke="#527078"
          strokeWidth="2"
          opacity=".5"
        />
        <path
          d="M185 201Q203 191 222 200M256 200Q274 192 291 200"
          fill="none"
          stroke="#382d2b"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M187 211Q205 203 220 213M258 213Q275 204 289 211"
          fill="none"
          stroke="#5a514c"
          strokeWidth="2"
        />
        <ellipse cx="207" cy="213" rx="5" ry="6" fill="#23353b" />
        <ellipse cx="271" cy="213" rx="5" ry="6" fill="#23353b" />
        <circle cx="209" cy="211" r="1.5" fill="white" />
        <circle cx="273" cy="211" r="1.5" fill="white" />
        <path
          d="M239 214L233 238Q239 243 246 238"
          stroke="#b68372"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M218 258Q239 269 259 256"
          stroke="#98655e"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M195 246Q203 250 212 248M270 248L280 244"
          stroke="#c28a7b"
          fill="none"
          opacity=".6"
        />
        <circle cx="173" cy="225" r="3" fill="#41dff1" />
      </g>
      <path
        d="M133 386Q112 420 117 464L186 490L205 466L160 443L175 405"
        fill="url(#jacket)"
        stroke="#3c5362"
      />
      <path
        d="M334 385Q362 414 363 459L294 490L276 467L320 443L305 405"
        fill="url(#jacket)"
        stroke="#3c5362"
      />
      <g visibility={flute ? "hidden" : "visible"}>
        <path
          d="M55 480L416 468L477 531L7 545Z"
          fill="url(#piano)"
          stroke="#45535e"
        />
        <path d="M49 497L412 489L448 520L28 530Z" fill="#b8c4cb" />
        {Array.from({ length: 22 }, (_, i) => (
          <path
            key={i}
            d={`M${50 + i * 16.4} 497L${30 + i * 18.7} 529`}
            stroke="#233440"
          />
        ))}
        {Array.from({ length: 17 }, (_, i) => (
          <path
            key={i}
            d={`M${60 + i * 20} 495L${53 + i * 20.5} 513`}
            stroke="#17232e"
            strokeWidth="7"
          />
        ))}
      </g>
      <g ref={hand} className="concept-hands">
        <path
          d="M180 464Q193 458 208 470L231 486Q237 493 231 495L213 487L225 504Q227 511 221 509L204 494L210 511Q210 517 205 513L190 495L191 511Q188 516 184 509L176 491L169 488Z"
          fill="url(#skin)"
          stroke="#bd937d"
        />
        <path
          d="M299 465Q286 459 270 471L248 487Q243 494 249 496L267 488L256 505Q253 511 260 509L276 494L270 510Q270 517 276 513L290 495L289 511Q293 516 297 508L305 490L311 485Z"
          fill="url(#skin)"
          stroke="#bd937d"
        />
      </g>
      {flute && (
        <g transform="translate(20 -90) rotate(-15 240 430)">
          <rect
            x="118"
            y="423"
            width="269"
            height="15"
            rx="7"
            fill="#bd8d4b"
            stroke="#ebbd76"
          />
          {[170, 195, 220, 245, 270, 295].map((x) => (
            <ellipse key={x} cx={x} cy="430" rx="5" ry="4" fill="#40301f" />
          ))}
        </g>
      )}
      <path
        d="M130 370L135 434M337 370L344 435"
        stroke="#00e5ff"
        strokeWidth="2"
        opacity=".4"
      />
      <circle cx="292" cy="354" r="3" fill="#00e5ff" />
      <path d="M18 544L470 531" stroke="#00e5ff" opacity=".15" />
    </svg>
  );
}
export default function IdolStage({ s, controller: c, camera, setCamera }) {
  const flute = s.lesson?.instrument === "sao_truc";
  return (
    <section className="idol-panel panel" aria-label="Sân khấu gia sư AI">
      <div className="idol-top">
        <span className="eyebrow">
          <span className="tiny-dot" />
          GIA SƯ CỦA BẠN
        </span>
        <span className="concept-badge">CONCEPT 2D</span>
      </div>
      <div className="portrait-stage">
        <div className="stage-rings" />
        <div className="stage-grid" />
        <div className="stage-halo" />
        <MentorConcept
          controller={c}
          closeup={camera === "hands"}
          flute={flute}
        />
        <div className="idol-name">
          <div className="flex items-center gap-2">
            <h2>{flute ? "Gia Phong" : "Minh An"}</h2>
            <span className="verified-icon">
              <Check size={10} />
            </span>
          </div>
          <p>{flute ? "Người bạn cùng nhịp thở" : "Người bạn bên phím đàn"}</p>
        </div>
        <div className="camera-switch segmented">
          <button
            className={camera === "full" ? "active" : ""}
            onClick={() => setCamera("full")}
          >
            <Maximize2 size={12} />
            Toàn cảnh
          </button>
          <button
            className={camera === "hands" ? "active" : ""}
            onClick={() => setCamera("hands")}
          >
            <Focus size={12} />
            Cận tay
          </button>
        </div>
      </div>
      <div className="tutor-area">
        <div className="tutor-label">
          <Sparkles size={14} />
          <span>Góc gia sư</span>
          <button
            className={`icon-button ${s.speech ? "is-active" : ""}`}
            aria-label="Bật hoặc tắt giọng trình duyệt"
            title="Giọng đọc của trình duyệt, chưa phải giọng idol"
            onClick={() => c.toggleSpeech()}
          >
            {s.speech ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
        <div className="feedback-bubble" aria-live="polite">
          <p>{s.feedback}</p>
          <div
            className={`voice-wave ${s.speaking ? "speaking" : ""}`}
            aria-label={
              s.speaking
                ? "Đang đọc bằng giọng trình duyệt"
                : "Nhận xét văn bản"
            }
          >
            {Array.from({ length: 23 }, (_, i) => (
              <i
                key={i}
                style={{
                  "--i": i,
                  height: `${4 + Math.sin(i * 1.6) ** 2 * 16}px`,
                }}
              />
            ))}
          </div>
        </div>
        {s.question && (
          <button className="self-assess" onClick={() => c.reveal()}>
            Tự nghe: {s.question}
            <ChevronRight size={14} />
          </button>
        )}
        <div className="mentor-footer">
          <span className="tiny-dot" />
          <span>Phản hồi từ bản nhạc & tín hiệu chơi</span>
        </div>
      </div>
    </section>
  );
}
