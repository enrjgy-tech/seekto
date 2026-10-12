// Research & assignments: a topic, the rubric, a schedule back from the due date,
// your related notes, and sources, including YouTube videos you can ask questions of.
import { $, $$, html, raw, toast, esc, readFile, friendlyDate, download } from "./ui.js";
import { state, saveProject, deleteProject, saveEvent, hasEvent, noteText, today } from "./state.js";
import { uid } from "./store.js";
import { go } from "./nav.js";
import {
  searchNotes, videoId, watchUrl, parseCaptions, parseTranscriptText, buildIndex, search, formatTime,
  toISO, fromISO, describeDay, isReady, chat, tokens, stem,
} from "../engine/index.js";
import { openQuiz } from "./quiz.js";

const TYPES = ["Essay", "Research paper", "Presentation", "Lab report", "Project", "Study for a test", "Other"];

export function renderList(main) {
  const assignments = state.events.filter((e) => e.type === "assignment" && e.date >= today() && !state.projects.some((p) => p.eventId === e.id));
  main.innerHTML = html`
    <div class="view">
      <div class="view-head"><h1>Research &amp; assignments</h1><button class="btn" id="newProject">New assignment</button></div>
      <p class="sub">Put the topic, the rubric, your past notes and your sources, including videos, in one place. Seekto builds a schedule and a checklist from the rubric, and with an AI model, a plan and a research brief.</p>
      ${raw(assignments.length ? html`<section class="panel"><h2>From your calendar</h2><div class="agenda">${raw(assignments.map((e) => html`<div class="event"><span class="when">${describeDay(e.date, today())}</span><span>${e.title}</span><button class="btn ghost small" data-start="${e.id}">Start</button></div>`).join(""))}</div></section>` : "")}
      <section class="panel"><h2>Your assignments</h2><div class="agenda" id="projects"></div></section>
    </div>`;
  $("#projects").innerHTML = state.projects.length
    ? state.projects.map((p) => html`<button class="event" data-open="${p.id}" style="cursor:pointer;text-align:left"><span class="when">${p.due ? describeDay(p.due, today()) : "No due date"}</span><span>${p.title}</span><span class="kind assignment">${p.type}</span></button>`).join("")
    : `<p class="empty">No assignments yet.</p>`;
  $("#newProject").addEventListener("click", () => create({}));
  $$("[data-start]").forEach((b) => b.addEventListener("click", () => {
    const e = state.events.find((x) => x.id === b.dataset.start);
    create({ title: e.title.replace(/\s+due$/i, ""), due: e.date, eventId: e.id, topic: e.description || "" });
  }));
  $$("[data-open]").forEach((b) => b.addEventListener("click", () => go(`project/${b.dataset.open}`)));
}

async function create(seed) {
  const p = { id: uid("project"), createdAt: Date.now(), title: seed.title || "New assignment", type: "Essay", due: seed.due || "", topic: seed.topic || "", rubric: "", length: "", checklist: [], videos: [], links: [], plan: "", brief: "", eventId: seed.eventId || null };
  await saveProject(p);
  go(`project/${p.id}`);
}

function parseRubric(text) {
  return String(text)
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|[a-z][.)])\s*/i, "").trim())
    .filter((l) => l.length > 3)
    .map((l) => ({ text: l, done: false }));
}

/** Milestones counted back from the due date. */
function schedule(p) {
  if (!p.due) return [];
  const days = Math.round((fromISO(p.due) - fromISO(today())) / 86400000);
  if (days < 1) return [];
  const steps = p.type === "Study for a test"
    ? [[0.25, "Gather notes and make a practice test"], [0.6, "Practice test, review what you missed"], [0.9, "Final review"]]
    : [[0.2, "Research and collect sources"], [0.4, "Outline mapped to the rubric"], [0.7, "First draft"], [0.9, "Revise against the rubric"]];
  // One step per day where the time allows; when it doesn't, steps on the same day are merged.
  const out = [];
  for (const [f, label] of steps) {
    let day = Math.max(0, Math.min(days - 1, Math.round(days * f)));
    const prev = out[out.length - 1];
    if (prev && day <= prev.day) day = prev.day + 1;
    if (prev && day > days - 1) { prev.labels.push(label.toLowerCase()); continue; }
    out.push({ day, labels: [label] });
  }
  return out.map(({ day, labels }) => {
    const d = fromISO(today());
    d.setDate(d.getDate() + day);
    return { date: toISO(d), title: `${p.title}: ${labels.join(", then ")}` };
  });
}

export function renderDetail(main, id) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) { main.innerHTML = `<div class="view"><p class="empty">That assignment doesn't exist anymore.</p></div>`; return; }
  const save = () => saveProject(p);
  main.innerHTML = html`
    <div class="view">
      <div class="view-head"><button class="btn ghost small" id="back">← Research</button>
        <div class="row"><button class="btn ghost small" id="exportP">Export</button><button class="btn danger small" id="del">Delete</button></div></div>
      <input type="text" id="pTitle" value="${p.title}" aria-label="Assignment title" style="font-size:22px;font-weight:700;border:0;padding:0;background:none">
      <div class="row">
        <label class="field" style="flex:1;min-width:160px"><span class="label">Type</span><select id="pType">${raw(TYPES.map((t) => html`<option ${t === p.type ? "selected" : ""}>${t}</option>`).join(""))}</select></label>
        <label class="field" style="flex:1;min-width:160px"><span class="label">Due</span><input type="date" id="pDue" value="${p.due}"></label>
        <label class="field" style="flex:1;min-width:160px"><span class="label">Length</span><input type="text" id="pLen" value="${p.length}" placeholder="1,500 words"></label>
      </div>
      <label class="field"><span class="label">Topic or question</span><textarea id="pTopic" rows="2" placeholder="How did the printing press change the Reformation?">${p.topic}</textarea></label>
      <label class="field"><span class="label">Rubric (paste it)</span><textarea id="pRubric" rows="5" placeholder="Thesis is clear and arguable (20 pts)&#10;Uses at least 3 credible sources (20 pts)…">${p.rubric}</textarea></label>
      <div class="row">
        <button class="btn" id="planBtn">Make a plan</button>
        <button class="btn ghost" id="briefBtn">Research brief</button>
        <button class="btn ghost" id="quizBtn">Quiz me on my sources</button>
      </div>
      <div class="detail">
        <section class="panel">
          <h2>Rubric checklist</h2><div id="checklist"></div>
          <h2>Schedule</h2><div id="sched" class="agenda"></div>
          <div id="planBox" style="white-space:pre-wrap"></div>
          <div id="briefBox" style="white-space:pre-wrap"></div>
        </section>
        <section class="panel">
          <h2>From your notes</h2><div id="related" class="agenda"></div>
          <h2>Videos</h2>
          <form id="vidForm" class="field">
            <input type="url" id="vidUrl" placeholder="YouTube link" aria-label="YouTube link">
            <textarea id="vidT" rows="3" placeholder="Paste the video's transcript (with times), or add a caption file below"></textarea>
            <div class="row"><button class="btn small">Add video</button><label class="btn ghost small" style="cursor:pointer">Caption file<input type="file" id="vidFile" accept=".vtt,.srt,.txt" hidden></label></div>
            <p class="note-small">Seekto plays videos in YouTube's player and never downloads them. To ask a video questions, add its transcript or captions.</p>
          </form>
          <div id="videos" style="display:grid;gap:10px"></div>
          <h2>Links</h2>
          <form id="linkForm" class="row"><input type="url" id="linkUrl" placeholder="https://… a source you found" style="flex:1"><button class="btn small">Add</button></form>
          <div id="links" class="agenda"></div>
        </section>
      </div>
    </div>`;

  $("#back").addEventListener("click", () => go("research"));
  $("#del").addEventListener("click", async () => {
    if ($("#del").dataset.sure !== "1") { $("#del").dataset.sure = "1"; $("#del").textContent = "Tap again to delete"; return; }
    await deleteProject(p.id); go("research");
  });
  $("#exportP").addEventListener("click", () => download(`${p.title.replace(/[^\w-]+/g, "-")}.md`, toMarkdown(p), "text/markdown"));
  const bind = (sel, key, after) => $(sel).addEventListener("change", async (e) => { p[key] = e.target.value; await save(); after?.(); });
  bind("#pTitle", "title");
  bind("#pType", "type", drawSchedule);
  bind("#pDue", "due", drawSchedule);
  bind("#pLen", "length");
  bind("#pTopic", "topic", drawRelated);
  bind("#pRubric", "rubric", async () => {
    const old = new Map(p.checklist.map((c) => [c.text, c.done]));
    p.checklist = parseRubric(p.rubric).map((c) => ({ ...c, done: old.get(c.text) || false }));
    await save(); drawChecklist(); drawRelated();
  });

  function drawChecklist() {
    $("#checklist").innerHTML = p.checklist.length
      ? p.checklist.map((c, i) => html`<label class="row" style="align-items:flex-start;flex-wrap:nowrap"><input type="checkbox" data-i="${i}" ${raw(c.done ? "checked" : "")} style="margin-top:4px"><span>${c.text}</span></label>`).join("")
      : `<p class="empty">Paste the rubric above and it becomes a checklist.</p>`;
    $$("#checklist input").forEach((cb) => cb.addEventListener("change", async () => { p.checklist[cb.dataset.i].done = cb.checked; await save(); }));
  }

  function drawSchedule() {
    const steps = schedule(p);
    $("#sched").innerHTML = steps.length
      ? steps.map((s) => html`<div class="event"><span class="when">${describeDay(s.date, today())}</span><span>${s.title.replace(`${p.title}: `, "")}</span><span></span></div>`).join("") + `<button class="btn ghost small" id="addSched">Add these to my calendar</button>`
      : `<p class="empty">${p.due ? "The due date has passed." : "Set a due date to get a schedule."}</p>`;
    $("#addSched")?.addEventListener("click", async () => {
      let n = 0;
      for (const s of steps) { const ev = { id: uid("event"), ...s, type: "assignment", source: "plan" }; if (!hasEvent(ev)) { await saveEvent(ev); n++; } }
      if (p.due) { const dueEv = { id: uid("event"), title: `${p.title} due`, date: p.due, type: "assignment", source: "plan" }; if (!hasEvent(dueEv)) { await saveEvent(dueEv); n++; } }
      toast(`Added ${n} date${n === 1 ? "" : "s"} to your calendar`);
    });
  }

  function relatedHits() {
    const q = `${p.title} ${p.topic} ${p.rubric}`.slice(0, 600);
    return searchNotes(state.notes.map((n) => ({ ...n, text: noteText(n) })), q, 6);
  }

  function drawRelated() {
    const hits = relatedHits();
    $("#related").innerHTML = hits.length
      ? hits.map((h) => html`<a class="event" href="#note/${h.note.id}" style="text-decoration:none"><span class="when">${friendlyDate(h.note.date)}</span><span>${h.note.title}: <span class="note-small">"${h.line.slice(0, 120)}"</span></span><span></span></a>`).join("")
      : `<p class="empty">No related notes yet. Add a topic, or record the class where it was assigned.</p>`;
  }

  function drawVideos() {
    $("#videos").innerHTML = p.videos.map((v, i) => html`
      <div class="ans" data-v="${i}">
        <div class="row" style="justify-content:space-between"><b>${v.title}</b><span class="row"><a class="btn ghost small" href="${watchUrl(v.videoId, 0)}" target="_blank" rel="noopener">YouTube</a><button class="btn ghost small" data-open="${i}">${v.open ? "Close" : "Open"}</button><button class="btn ghost small" data-rm="${i}" aria-label="Remove video">×</button></span></div>
        ${raw(v.open ? html`<div class="player" id="yt-${i}"></div>
          ${raw(v.cues?.length ? html`<form class="row" data-ask="${i}"><input type="text" placeholder="Ask this video" style="flex:1"><button class="btn small">Ask</button></form><div data-ans="${i}" style="display:grid;gap:6px"></div>` : `<p class="note-small">Add this video's transcript to ask it questions.</p>`)}` : "")}
        <span class="note-small">${v.cues?.length ? `${v.cues.length} transcript lines` : "No transcript"}</span>
      </div>`).join("") || `<p class="empty">No videos yet.</p>`;
    $$("[data-open]", $("#videos")).forEach((b) => b.addEventListener("click", () => { const v = p.videos[b.dataset.open]; v.open = !v.open; drawVideos(); }));
    $$("[data-rm]", $("#videos")).forEach((b) => b.addEventListener("click", async () => { p.videos.splice(Number(b.dataset.rm), 1); await save(); drawVideos(); }));
    $$("[data-ask]", $("#videos")).forEach((f) => f.addEventListener("submit", (e) => {
      e.preventDefault();
      const i = Number(f.dataset.ask);
      const q = f.querySelector("input").value.trim();
      const res = search(buildIndex(p.videos[i].cues), q);
      const terms = new Set(tokens(q));
      $(`[data-ans="${i}"]`).innerHTML = res.length
        ? res.map((r) => `<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><button class="btn small" data-seek="${r.start}">▶ ${formatTime(r.start)}</button><span>${esc(r.context).replace(/[A-Za-z0-9]+/g, (w) => (terms.has(stem(w.toLowerCase())) ? `<mark>${w}</mark>` : w))}</span></div>`).join("")
        : `<p class="empty">Nothing in this video matches.</p>`;
      $$(`[data-ans="${i}"] [data-seek]`).forEach((b) => b.addEventListener("click", () => seekVideo(i, Number(b.dataset.seek))));
      if (res[0]) seekVideo(i, res[0].start);
    }));
    for (const [i, v] of p.videos.entries()) if (v.open) mountPlayer(i);
  }

  const players = {};
  async function mountPlayer(i) {
    const el = $(`#yt-${i}`);
    if (!el) return;
    const ok = await loadYouTube();
    if (!el.isConnected) return;
    if (!ok) {
      el.innerHTML = `<p class="note-small" style="padding:12px">The video player couldn't load here. <a href="${watchUrl(p.videos[i].videoId, 0)}" target="_blank" rel="noopener">Open on YouTube</a>.</p>`;
      return;
    }
    players[i] = new window.YT.Player(el, { videoId: p.videos[i].videoId, playerVars: { rel: 0, playsinline: 1 } });
  }
  function seekVideo(i, t) {
    const pl = players[i];
    if (pl?.seekTo) { pl.seekTo(t, true); pl.playVideo(); } else window.open(watchUrl(p.videos[i].videoId, t), "_blank", "noopener");
  }

  function drawLinks() {
    $("#links").innerHTML = p.links.map((l, i) => html`<div class="event"><span class="when">${l.added}</span><a href="${l.url}" target="_blank" rel="noopener" style="overflow-wrap:anywhere">${l.url}</a><button class="btn ghost small" data-lrm="${i}" aria-label="Remove link">×</button></div>`).join("") || `<p class="empty">No links yet.</p>`;
    $$("[data-lrm]").forEach((b) => b.addEventListener("click", async () => { p.links.splice(Number(b.dataset.lrm), 1); await save(); drawLinks(); }));
  }

  let pendingCaptions = "";
  $("#vidFile").addEventListener("change", async (e) => { pendingCaptions = await readFile(e.target.files[0]); toast("Caption file ready. Now add the video."); });
  $("#vidForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = videoId($("#vidUrl").value);
    if (!id) return toast("Paste a YouTube link, like https://youtu.be/…");
    const text = pendingCaptions || $("#vidT").value;
    const cues = text.trim() ? (/-->/.test(text) ? parseCaptions(text) : parseTranscriptText(text)) : [];
    if (text.trim() && !cues.length) return toast("That transcript has no times. Use a caption file or lines like 1:05.");
    p.videos.push({ videoId: id, title: `Video ${p.videos.length + 1} (${id})`, cues, open: false });
    pendingCaptions = "";
    $("#vidUrl").value = ""; $("#vidT").value = "";
    await save(); drawVideos();
  });
  $("#linkForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = $("#linkUrl").value.trim();
    if (!/^https?:\/\//.test(url)) return toast("Paste a full link starting with https://");
    p.links.push({ url, added: friendlyDate(today()) });
    $("#linkUrl").value = "";
    await save(); drawLinks();
  });

  $("#planBtn").addEventListener("click", async () => {
    p.checklist = p.checklist.length ? p.checklist : parseRubric(p.rubric);
    drawChecklist(); drawSchedule();
    if (!isReady(state.settings)) {
      p.plan = localPlan(p);
      $("#planBox").textContent = p.plan;
      await save();
      return;
    }
    $("#planBox").textContent = "Making a plan…";
    try {
      p.plan = await chat(state.settings, { system: SYSTEM, messages: [{ role: "user", content: `${context(p, relatedHits())}\n\nMake a plan: 2 or 3 possible thesis statements or angles, an outline where each section says which rubric points it covers, the research questions to answer, the kinds of sources to look for, and a short schedule before the due date.` }], maxTokens: 1400 });
    } catch (err) { p.plan = `${localPlan(p)}\n\n(${err.message})`; }
    $("#planBox").textContent = p.plan;
    await save();
  });
  $("#briefBtn").addEventListener("click", async () => {
    if (!isReady(state.settings)) { $("#briefBox").innerHTML = `A research brief uses an AI model. <a href="#settings">Choose one in Settings</a>. For research with live web sources, pick a model with web search (for example an OpenRouter model ending in :online).`; return; }
    $("#briefBox").textContent = "Researching…";
    try {
      p.brief = await chat(state.settings, { system: SYSTEM, messages: [{ role: "user", content: `${context(p, relatedHits())}\n\nWrite a research brief on this topic for a student: background, the main arguments and evidence on each side, key terms, and specific sources worth finding (with authors or titles where you are confident, and links only if you have web access). Mark anything uncertain. End with how it maps to the rubric.` }], maxTokens: 2200 });
      p.brief = `${p.brief}\n\nCheck every source and fact before you use it.`;
    } catch (err) { p.brief = err.message; }
    $("#briefBox").textContent = p.brief;
    await save();
  });
  $("#quizBtn").addEventListener("click", () => {
    const notes = [
      ...relatedHits().map((h) => state.notes.find((n) => n.id === h.note.id)).filter(Boolean),
      ...p.videos.filter((v) => v.cues?.length).map((v) => ({ title: v.title, text: v.cues.map((c) => c.text).join(" ") })),
    ];
    if (!notes.length) return toast("Add related notes or a video transcript first");
    openQuiz({ notes: [...new Map(notes.map((n) => [n.title, n])).values()], title: `Quiz: ${p.title}` });
  });

  drawChecklist(); drawSchedule(); drawRelated(); drawVideos(); drawLinks();
  if (p.plan) $("#planBox").textContent = p.plan;
  if (p.brief) $("#briefBox").textContent = p.brief;
}

const SYSTEM = "You are Seekto, helping a student plan and research their own assignment. Be specific and organized. Help them think, plan and find sources; don't write the finished assignment for them.";

function context(p, hits) {
  const notes = hits.map((h) => `- [${h.note.title}] ${h.line}`).join("\n") || "(none)";
  const videos = p.videos.filter((v) => v.cues?.length).map((v) => `${v.title}: ${v.cues.map((c) => c.text).join(" ").slice(0, 3000)}`).join("\n\n") || "(none)";
  return `Assignment: ${p.title} (${p.type})${p.due ? `, due ${p.due}` : ""}${p.length ? `, length ${p.length}` : ""}
Topic: ${p.topic || "(not set)"}
Rubric:
${p.rubric || "(not provided)"}
Related lines from the student's class notes:
${notes}
Video transcripts:
${videos}`;
}

function localPlan(p) {
  const steps = schedule(p);
  const lines = [
    "Plan",
    ...(p.checklist.length ? ["", "Outline (one section per rubric point):", ...p.checklist.map((c, i) => `${i + 1}. ${c.text}`)] : ["", "Paste the rubric to turn it into an outline."]),
    ...(steps.length ? ["", "Schedule:", ...steps.map((s) => `• ${friendlyDate(s.date)}: ${s.title.replace(`${p.title}: `, "")}`)] : []),
    "", "Connect an AI model in Settings for thesis ideas, research questions and a research brief.",
  ];
  return lines.join("\n");
}

function toMarkdown(p) {
  return [
    `# ${p.title}`, `${p.type}${p.due ? ` · due ${p.due}` : ""}${p.length ? ` · ${p.length}` : ""}`, "",
    "## Topic", p.topic || "", "", "## Rubric", ...p.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`), "",
    ...(p.plan ? ["## Plan", p.plan, ""] : []), ...(p.brief ? ["## Research brief", p.brief, ""] : []),
    "## Sources", ...p.videos.map((v) => `- ${watchUrl(v.videoId, 0)}`), ...p.links.map((l) => `- ${l.url}`),
  ].join("\n");
}

let ytLoading = null;
function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(true);
  if (ytLoading) return ytLoading;
  ytLoading = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(true); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
    setTimeout(() => resolve(Boolean(window.YT?.Player)), 6000);
  });
  return ytLoading;
}
