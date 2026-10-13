// Samples: one click shows what Seekto does with a class or a meeting, using a short scripted
// transcript instead of the microphone. Samples are marked so they can be removed in one go.
import { state, saveNote, deleteNote, deleteEvent } from "./state.js";
import { uid } from "./store.js";
import { toISO, detectTopic } from "../engine/index.js";
import { addDates, meetingParts } from "./capture.js";
import { lang, t } from "./i18n.js";

const CLASS = {
  title: "Biology: Cell division",
  subject: "Biology",
  lines: [
    "Okay everyone, today we're starting chapter five, which is all about how cells divide.",
    "Mitosis means one cell dividing into two identical daughter cells.",
    "Before a cell divides, it copies its DNA, so each new cell gets a full set of chromosomes.",
    "A chromosome is a long strand of DNA wrapped around proteins.",
    "The centromere is the point where the two copies of a chromosome are held together.",
    "Meiosis is the kind of division that makes sperm and egg cells, with half the chromosomes.",
    "Remember, mitosis is for growth and repair, and meiosis is for reproduction.",
    "The chapter five quiz is on Friday, so review the four phases of mitosis.",
    "The onion root lab report is due next Wednesday.",
    "Cytokinesis is the final step, when the cytoplasm splits into two cells.",
  ],
};

const MEETING = {
  title: "Launch sync",
  subject: "Meeting",
  lines: [
    "Okay, let's get started. Thanks everyone for joining the launch sync.",
    "First, the beta. We decided to launch the beta on November 2nd.",
    "Maria will send the updated pitch deck to the client by Friday.",
    "Sam to book the room for the customer workshop.",
    "I'll write up the survey results tomorrow and share them in the channel.",
    "We agreed that support hours stay the same through the holidays.",
    "Can you send the budget spreadsheet to finance?",
    "Let's schedule a review with legal next Tuesday.",
    "Priya will update the onboarding guide before the beta goes out.",
    "Great, that's everything. Thanks all.",
  ],
};

// The same class in Spanish and Portuguese, for those interfaces. (Meeting rules are English only.)
const CLASS_ES = {
  title: "Biología: División celular",
  subject: "Biología",
  lines: [
    "Bueno, chicos, hoy empezamos el tema cinco, que trata de cómo se dividen las células.",
    "La mitosis es la división de una célula en dos células hijas idénticas.",
    "Antes de dividirse, la célula copia su ADN, así cada célula nueva recibe todos los cromosomas.",
    "Un cromosoma es una molécula larga de ADN enrollada alrededor de proteínas.",
    "El centrómero es el punto donde se unen las dos copias de un cromosoma.",
    "La meiosis es la división que forma óvulos y espermatozoides, con la mitad de los cromosomas.",
    "Recuerden, la mitosis sirve para crecer y reparar tejidos, y la meiosis para la reproducción.",
    "La prueba del tema cinco es el viernes, así que repasen las cuatro fases de la mitosis.",
    "El informe del laboratorio de la raíz de cebolla se entrega el miércoles de la próxima semana.",
    "La citocinesis es el paso final, cuando el citoplasma se divide en dos células.",
  ],
};
const CLASS_PT = {
  title: "Biologia: Divisão celular",
  subject: "Biologia",
  lines: [
    "Bom, pessoal, hoje a gente começa o capítulo cinco, que é sobre como as células se dividem.",
    "Mitose é a divisão de uma célula em duas células-filhas idênticas.",
    "Antes de se dividir, a célula copia o seu DNA, então cada célula nova recebe todos os cromossomos.",
    "Cromossomo é uma molécula longa de DNA enrolada em proteínas.",
    "O centrômero é o ponto onde as duas cópias de um cromossomo ficam unidas.",
    "Meiose é a divisão que forma os gametas, com metade dos cromossomos.",
    "Lembrem: a mitose serve para crescer e reparar tecidos, e a meiose para a reprodução.",
    "A prova do capítulo cinco é na sexta, então revisem as quatro fases da mitose.",
    "O relatório da aula prática da raiz de cebola é pra quarta-feira que vem.",
    "Citocinese é a etapa final, quando o citoplasma se divide em duas células.",
  ],
};

export const sampleScript = (kind) => (kind === "work" ? MEETING : lang === "es" ? CLASS_ES : lang === "pt" ? CLASS_PT : CLASS);

/** Load a sample class or meeting. Returns { note, added, decisions, actions }. */
export async function loadSample(kind = "learning") {
  const s = sampleScript(kind);
  const createdAt = Date.now();
  const cues = s.lines.map((text, i) => ({ start: i * 9 + 2, text }));
  const note = {
    id: uid("note"), kind: "recording", sample: true, createdAt, date: toISO(new Date(createdAt)), duration: s.lines.length * 9 + 4,
    title: s.title, subject: s.subject, topic: kind === "work" ? "Beta launch" : detectTopic(s.lines.join(" ")),
    cues, marks: kind === "work" ? [] : [{ start: 38, label: t("Lost here") }], mine: [], text: s.lines.join(" "),
    ...(kind === "work" ? { mode: "work" } : {}),
  };
  const added = await addDates(note, { sample: true });
  await saveNote(note);
  const { decisions, actions } = kind === "work" ? meetingParts(note) : { decisions: [], actions: [] };
  return { note, added, decisions, actions };
}

export const hasSamples = () => state.notes.some((n) => n.sample);

export async function removeSamples() {
  for (const e of state.events.filter((x) => x.sample)) await deleteEvent(e.id);
  for (const n of state.notes.filter((x) => x.sample)) await deleteNote(n.id);
}
