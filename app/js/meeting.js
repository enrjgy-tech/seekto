// Meeting notes: decisions, action items and a follow-up email draft.
import { $, html, raw, copy, openOverlay, closeOverlay, friendlyDate } from "./ui.js";
import { state } from "./state.js";
import { followUpEmail, chat, isReady } from "../engine/index.js";
import { meetingParts } from "./capture.js";

/** HTML for the "Decisions and action items" panel of a meeting note. */
export function meetingPanelHtml(note) {
  const { decisions, actions } = meetingParts(note);
  const dec = decisions.length
    ? decisions.map((d) => html`<li>${d.text}</li>`).join("")
    : `<li class="note-small">None found yet.</li>`;
  const act = actions.length
    ? actions.map((a) => html`<li><b>${a.owner || "Unassigned"}</b> · ${a.task}${raw(a.due ? html` <span class="note-small">· ${friendlyDate(a.due)}</span>` : "")}</li>`).join("")
    : `<li class="note-small">None found yet.</li>`;
  return html`
    <span class="label">Decisions</span><ul class="plain">${raw(dec)}</ul>
    <span class="label">Action items</span><ul class="plain">${raw(act)}</ul>
    <button class="btn small" data-followup="${note.id}">Draft follow-up email</button>`;
}

/** Overlay with a follow-up email the user can copy or open in their mail app. */
export function openFollowUp(note) {
  const { decisions, actions } = meetingParts(note);
  let email = followUpEmail({ title: note.title, decisions, actions, formatDate: friendlyDate });
  const sheet = openOverlay("");
  const draw = () => {
    sheet.innerHTML = html`
      <div class="view-head"><h2>Follow-up email</h2><button class="btn ghost small" data-close>Close</button></div>
      <label class="field"><span class="label">Subject</span><input type="text" id="fuSubject" value="${email.subject}"></label>
      <label class="field"><span class="label">Message</span><textarea id="fuBody" rows="14">${email.body}</textarea></label>
      <div class="row">
        <button class="btn" id="fuCopy">Copy</button>
        <a class="btn ghost" id="fuMail" href="#">Open in my email app</a>
        ${raw(isReady(state.settings) ? `<button class="btn ghost" id="fuAi">Polish with AI</button>` : "")}
      </div>
      <p class="note-small">Check names and dates before you send it. Seekto never sends email for you.</p>`;
    sheet.querySelector("[data-close]").addEventListener("click", closeOverlay);
    const read = () => ({ subject: $("#fuSubject", sheet).value, body: $("#fuBody", sheet).value });
    $("#fuCopy", sheet).addEventListener("click", () => { const e = read(); copy(`Subject: ${e.subject}\n\n${e.body}`, "Email copied"); });
    $("#fuMail", sheet).addEventListener("click", (ev) => { ev.preventDefault(); const e = read(); location.href = `mailto:?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`; });
    $("#fuAi", sheet)?.addEventListener("click", async (ev) => {
      ev.target.disabled = true;
      ev.target.textContent = "Polishing…";
      try {
        const body = await chat(state.settings, {
          system: "You tidy up meeting follow-up emails. Keep every fact, name and date. Be brief and friendly. Reply with the email body only.",
          messages: [{ role: "user", content: `${read().body}\n\nMeeting transcript for context:\n${(note.text || "").slice(0, 8000)}` }],
          maxTokens: 700,
        });
        email = { subject: read().subject, body: body.trim() };
        draw();
      } catch (err) {
        ev.target.textContent = err.message;
      }
    });
  };
  draw();
}
