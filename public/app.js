const STEP = 5;
const REST_PRESETS = [60, 75, 90];

const EX_META = [];
Object.entries(PROGRAM).forEach(([day, d]) =>
  d.groups.forEach((g) => g.exercises.forEach((e) => EX_META.push({ ...e, day })))
);

function buildDefaults() {
  const out = {};
  EX_META.forEach((e) => { out[e.id] = e.defWeight; });
  return out;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function prettyDate(s) {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---- App state ----
let state = {
  mode: "train",
  day: "A",
  weights: buildDefaults(),
  done: {},        // exerciseId -> sets completed (local only, resets on Reset)
  sessions: [],     // loaded from server
  expandedEx: null, // for progress view accordion
};

let weightSaveTimer = null;
let restTimer = { remaining: 0, running: false, intervalId: null };

// ---- API helpers ----
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}
async function apiSend(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `${method} ${path} failed: ${res.status}`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Initial load ----
async function init() {
  try {
    const [{ weights }, { sessions }] = await Promise.all([
      apiGet("/api/state"),
      apiGet("/api/sessions"),
    ]);
    state.weights = { ...buildDefaults(), ...(weights || {}) };
    state.sessions = sessions || [];
  } catch (err) {
    console.error("Initial load failed:", err);
    document.getElementById("subtitle").textContent = "Couldn't reach the server — showing defaults";
  }
  render();
}

// ---- Debounced weight save (avoid a request per tap) ----
function scheduleWeightSave() {
  clearTimeout(weightSaveTimer);
  weightSaveTimer = setTimeout(async () => {
    try { await apiSend("/api/state", "PUT", { weights: state.weights }); }
    catch (e) { console.error("Weight save failed:", e); }
  }, 1200);
}

// ---- Rendering ----
function render() {
  document.getElementById("subtitle").textContent =
    state.mode === "train" ? PROGRAM[state.day].subtitle : "Progression over time";

  document.querySelectorAll("#modeToggle .seg-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === state.mode)
  );
  document.getElementById("trainView").classList.toggle("hidden", state.mode !== "train");
  document.getElementById("progressView").classList.toggle("hidden", state.mode !== "progress");
  document.querySelector(".rest-bar").classList.toggle("hidden", state.mode !== "train");

  if (state.mode === "train") renderTrain(); else renderProgress();
}

function renderTrain() {
  document.querySelectorAll("#dayToggle .seg-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.day === state.day)
  );

  const groupsEl = document.getElementById("groups");
  groupsEl.innerHTML = "";
  PROGRAM[state.day].groups.forEach((g) => {
    const gEl = document.createElement("div");
    gEl.className = "group";
    gEl.innerHTML = `
      <div class="group-head">
        <span class="group-label">${g.label}</span>
        <span class="group-hint">· ${g.hint}</span>
      </div>
      <div class="group-items ${g.exercises.length > 1 ? "paired" : ""}"></div>
    `;
    const itemsEl = gEl.querySelector(".group-items");
    g.exercises.forEach((ex) => itemsEl.appendChild(renderExerciseCard(ex)));
    groupsEl.appendChild(gEl);
  });

  renderRestControls();
}

function renderExerciseCard(ex) {
  const weight = state.weights[ex.id] ?? ex.defWeight;
  const done = state.done[ex.id] || 0;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-top">
      <h3 class="card-name">${ex.name}</h3>
      <span class="card-scheme">${ex.scheme}</span>
    </div>
    <p class="card-target">${ex.target}</p>
    <div class="card-row">
      <div class="stepper">
        <button class="step-btn minus" aria-label="Decrease weight">−</button>
        <div class="weight-box">
          <input class="weight-input" inputmode="numeric" value="${weight}" />
          <span class="weight-unit">lb</span>
        </div>
        <button class="step-btn plus" aria-label="Increase weight">+</button>
      </div>
      <div class="dots"></div>
    </div>
  `;

  const dotsEl = card.querySelector(".dots");
  for (let i = 0; i < ex.sets; i++) {
    const dot = document.createElement("button");
    dot.className = "dot" + (i < done ? " done" : "");
    dot.textContent = i < done ? "✓" : String(i + 1);
    dot.addEventListener("click", () => {
      state.done[ex.id] = i < done ? i : i + 1;
      renderTrain();
    });
    dotsEl.appendChild(dot);
  }

  const input = card.querySelector(".weight-input");
  const setW = (v) => {
    const n = Math.max(0, v);
    state.weights[ex.id] = n;
    input.value = n;
    scheduleWeightSave();
  };
  card.querySelector(".minus").addEventListener("click", () => setW((state.weights[ex.id] ?? ex.defWeight) - STEP));
  card.querySelector(".plus").addEventListener("click", () => setW((state.weights[ex.id] ?? ex.defWeight) + STEP));
  input.addEventListener("change", () => {
    const n = parseInt(input.value.replace(/[^0-9]/g, ""), 10);
    setW(isNaN(n) ? 0 : n);
  });

  return card;
}

// ---- Rest timer ----
function renderRestControls() {
  const el = document.getElementById("restControls");
  el.innerHTML = "";
  if (!restTimer.running && restTimer.remaining === 0) {
    REST_PRESETS.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = "rest-preset";
      btn.textContent = `${s}s`;
      btn.addEventListener("click", () => startRest(s));
      el.appendChild(btn);
    });
  } else {
    const mm = Math.floor(restTimer.remaining / 60);
    const ss = String(restTimer.remaining % 60).padStart(2, "0");
    const span = document.createElement("span");
    span.className = "rest-time" + (restTimer.remaining <= 5 ? " low" : "");
    span.textContent = `${mm}:${ss}`;
    const stop = document.createElement("button");
    stop.className = "rest-stop";
    stop.textContent = "✕";
    stop.addEventListener("click", stopRest);
    el.appendChild(span);
    el.appendChild(stop);
  }
}
function startRest(seconds) {
  clearInterval(restTimer.intervalId);
  restTimer.remaining = seconds;
  restTimer.running = true;
  restTimer.intervalId = setInterval(() => {
    restTimer.remaining -= 1;
    if (restTimer.remaining <= 0) stopRest();
    else renderRestControls();
  }, 1000);
  renderRestControls();
}
function stopRest() {
  clearInterval(restTimer.intervalId);
  restTimer.remaining = 0;
  restTimer.running = false;
  renderRestControls();
}

// ---- Logging a session (with retry) ----

async function logSession() {
  const btn = document.getElementById("logBtn");
  const note = document.getElementById("saveNote");
  const ids = PROGRAM[state.day].groups.flatMap((g) => g.exercises.map((e) => e.id));
  const snapshot = {};
  ids.forEach((id) => { snapshot[id] = state.weights[id] ?? 0; });

  clearTimeout(weightSaveTimer);
  btn.className = "log-btn saving";
  btn.textContent = "Saving…";
  btn.disabled = true;
  note.textContent = "";
  note.className = "save-note";

  const waits = [0, 1500, 3500, 7000];
  let lastErr = null;
  for (let i = 0; i < waits.length; i++) {
    if (waits[i] > 0) await sleep(waits[i]);
    try {
      const { session } = await apiSend("/api/sessions", "POST", {
        day: state.day, weights: snapshot, date: todayStr(),
      });
      state.sessions.push(session);
      btn.className = "log-btn saved";
      btn.innerHTML = `✓ Logged ${prettyDate(session.date)}`;
      note.textContent = "Confirmed saved to the server";
      note.className = "save-note ok";
      setTimeout(() => {
        btn.className = "log-btn";
        btn.textContent = `Log session · ${prettyDate(todayStr())}`;
        btn.disabled = false;
        note.textContent = "";
      }, 2500);
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  btn.className = "log-btn error";
  btn.textContent = "Save failed — tap to retry";
  btn.disabled = false;
  note.textContent = `Didn't save: ${lastErr ? lastErr.message : "unknown error"}`;
  note.className = "save-note err";
}

async function deleteSession(id) {
  try {
    await apiSend(`/api/sessions/${id}`, "DELETE", {});
    state.sessions = state.sessions.filter((s) => s.id !== id);
    renderProgress();
  } catch (e) {
    alert("Couldn't delete that session: " + e.message);
  }
}

// ---- Progress view ----
function sparklinePath(values, w, h) {
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (w - pad * 2),
    pad + (1 - (v - min) / range) * (h - pad * 2),
  ]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return { path, last: pts[pts.length - 1] };
}

function renderProgress() {
  const el = document.getElementById("progressView");
  const sorted = [...state.sessions].sort((a, b) => a.ts - b.ts);

  if (sorted.length === 0) {
    el.innerHTML = `
      <div class="progress-empty">
        <div class="big">No sessions logged yet</div>
        <div>Finish a workout and tap "Log session" to start tracking your weights over time.</div>
      </div>`;
    return;
  }

  let html = `<p class="progress-summary">${sorted.length} session${sorted.length > 1 ? "s" : ""} logged · tap an exercise for its full history</p>`;

  ["A", "B"].forEach((day) => {
    const rows = EX_META.filter((e) => e.day === day).map((e) => {
      const series = sorted.filter((s) => s.weights && e.id in s.weights)
        .map((s) => ({ date: s.date, w: s.weights[e.id] }));
      return { e, series };
    }).filter((r) => r.series.length > 0);
    if (rows.length === 0) return;

    html += `<div class="day-block"><div class="day-title">Workout ${day}</div>`;
    rows.forEach(({ e, series }) => {
      const first = series[0].w, last = series[series.length - 1].w;
      const delta = last - first;
      const isOpen = state.expandedEx === e.id;
      let spark = "";
      if (series.length >= 2) {
        const { path, last: lastPt } = sparklinePath(series.map((s) => s.w), 108, 34);
        spark = `<svg width="108" height="34"><path d="${path}" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="3" fill="#fbbf24"/></svg>`;
      } else {
        spark = `<div style="font-size:11px;color:#475569;font-style:italic">needs 2+ logs</div>`;
      }
      html += `
        <div class="ex-progress">
          <button class="ex-progress-head" data-exid="${e.id}">
            <div style="flex:1;min-width:0">
              <div class="ex-progress-name">${e.name}</div>
              <div><span class="ex-progress-last">${last} lb</span>${
                series.length > 1
                  ? `<span class="ex-progress-delta ${delta > 0 ? "pos" : delta < 0 ? "neg" : ""}">${delta > 0 ? "+" + delta : delta} since start</span>`
                  : ""
              }</div>
            </div>
            ${spark}
          </button>
          ${isOpen ? `<div class="ex-progress-history">${
            [...series].reverse().map((s) => `<div class="hist-row"><span class="hist-date">${prettyDate(s.date)}</span><span class="hist-w">${s.w} lb</span></div>`).join("")
          }</div>` : ""}
        </div>`;
    });
    html += `</div>`;
  });

  html += `<div class="sessions-list"><div class="sessions-title">Logged sessions</div>`;
  [...sorted].reverse().forEach((s) => {
    html += `
      <div class="session-row">
        <div><strong>${prettyDate(s.date)}</strong> <span style="color:#64748b">· Workout ${s.day}</span></div>
        <button class="session-del" data-delid="${s.id}">🗑</button>
      </div>`;
  });
  html += `</div>`;

  el.innerHTML = html;

  el.querySelectorAll(".ex-progress-head").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.exid;
      state.expandedEx = state.expandedEx === id ? null : id;
      renderProgress();
    })
  );
  el.querySelectorAll(".session-del").forEach((btn) =>
    btn.addEventListener("click", () => deleteSession(parseInt(btn.dataset.delid, 10)))
  );
}

// ---- Wire up top-level controls ----
document.getElementById("modeToggle").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  state.mode = btn.dataset.mode;
  render();
});
document.getElementById("dayToggle").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  state.day = btn.dataset.day;
  renderTrain();
});
document.getElementById("logBtn").addEventListener("click", logSession);
document.getElementById("resetBtn").addEventListener("click", () => {
  state.done = {};
  renderTrain();
});

init();
