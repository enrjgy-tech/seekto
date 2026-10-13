// Find dates and deadlines in spoken or written text, in English, Spanish and Portuguese:
// "the essay is due October 20th", "quiz on Friday", "el examen es el viernes",
// "a prova é na sexta que vem". It copes with the way people actually talk:
// corrections ("Wednesday, no, Thursday"), reschedules ("moved from Friday to Tuesday"),
// cancellations ("there's no quiz Monday") and past mentions ("last Friday's quiz").
// All dates are local calendar days returned as "YYYY-MM-DD".

const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
  // Spanish
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
  // Portuguese
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  marco: 2,
  maio: 4,
  junho: 5,
  julho: 6,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};
const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6,
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
};
const COUNTS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  "a couple of": 2,
  couple: 2,
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  três: 3,
  quatro: 4,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
  treinta: 30,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  vinte: 20,
  trinta: 30,
};

// Day numbers as words (Spanish and Portuguese), for transcripts that spell them out.
const DAY_WORDS = (() => {
  const es = [
    "",
    "uno|primero",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciseis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
    "veinte",
    "veintiuno",
    "veintidos",
    "veintitres",
    "veinticuatro",
    "veinticinco",
    "veintiseis",
    "veintisiete",
    "veintiocho",
    "veintinueve",
    "treinta",
    "treinta y uno",
  ];
  const ptUnits = ["", "um|primeiro", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const pt = [
    "",
    ...ptUnits.slice(1),
    "dez",
    "onze",
    "doze",
    "treze",
    "catorze|quatorze",
    "quinze",
    "dezesseis",
    "dezessete",
    "dezoito",
    "dezenove",
    "vinte",
    ...ptUnits.slice(1).map((u) =>
      u
        .split("|")
        .map((x) => `vinte e ${x}`)
        .join("|"),
    ),
    "trinta",
    "trinta e um",
  ];
  const map = {};
  [es, pt].forEach((list) =>
    list.forEach((words, n) => {
      if (n) for (const w of words.split("|")) map[w] = n;
    }),
  );
  return map;
})();
const DAY_WORDS_RE = Object.keys(DAY_WORDS)
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/ /g, "\\s+").replace(/e/g, "[eé]").replace(/i/g, "[ií]").replace(/a/g, "[aá]"))
  .join("|");

// Ordinal day numbers as words (English): "the twenty first", "October third"
const EN_ORDINALS = (() => {
  const units = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
  const map = {};
  units.forEach((w, n) => {
    if (n) map[w] = n;
  });
  [
    "tenth",
    "eleventh",
    "twelfth",
    "thirteenth",
    "fourteenth",
    "fifteenth",
    "sixteenth",
    "seventeenth",
    "eighteenth",
    "nineteenth",
  ].forEach((w, i) => (map[w] = 10 + i));
  map.twentieth = 20;
  map.thirtieth = 30;
  units.forEach((w, n) => {
    if (n) map[`twenty ${w}`] = 20 + n;
  });
  map["thirty first"] = 31;
  return map;
})();
const EN_ORD_RE = Object.keys(EN_ORDINALS)
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/ /g, "[\\s-]+"))
  .join("|");
const ordinalValue = (w) => EN_ORDINALS[w.toLowerCase().replace(/[\s-]+/g, " ")];

const EN_MONTH =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const ANY_MONTH = `(${EN_MONTH.slice(1, -1)}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|janeiro|fevereiro|mar[çc]o|maio|junho|julho|setembro|outubro|novembro|dezembro)`;
const DAY = "(\\d{1,2})(?:st|nd|rd|th|º|°)?";
const COUNT =
  "(a couple of|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|\\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|um|uma|dois|duas|três|quatro|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|vinte|trinta)";
const EN_DAY = "(sunday|monday|tuesday|wednesday|thursday|friday|saturday)";
const L = "\\p{L}"; // any letter, for word edges that work with accents

// Words after an ordinal that mean it isn't a date ("the 3rd chapter").
const NOT_A_DAY =
  "century|grade|floor|period|edition|chapter|question|problem|page|place|time|times|year|semester|row|hour|amendment|unit|lab|week|day|term|class|section|step|attempt|try|person|one|ones|draft|version|round|quarter|inning|birthday|anniversary|street|lesson|module|homework|assignment|essay|quiz|test|exam|paper|grader|graders|edition|slide|item|law|power|degree|generation|largest|biggest|most|best";

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** The first `weekday` strictly after today. */
function upcoming(today, weekday) {
  return addDays(today, (weekday - today.getDay() + 7) % 7 || 7);
}
/** `weekday` in next week (weeks start on Monday). */
function nextWeek(today, weekday) {
  const toMonday = 7 - ((today.getDay() + 6) % 7);
  return addDays(today, toMonday + ((weekday + 6) % 7));
}
/** Friday of this week; on a weekend, the coming Friday. */
function endOfWeek(today) {
  return today.getDay() === 6 || today.getDay() === 0 ? upcoming(today, 5) : addDays(today, 5 - today.getDay());
}

/** A month and day with no year: this year, unless that is more than 30 days ago, then next year. */
function resolveYear(month, day, year, ref) {
  if (year) return new Date(year < 100 ? 2000 + year : year, month, day);
  const candidate = new Date(ref.getFullYear(), month, day);
  return candidate < addDays(ref, -30) ? new Date(ref.getFullYear() + 1, month, day) : candidate;
}

/** The next time this day of the month comes round (today counts). */
function nextDayOfMonth(today, day) {
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, day);
    if (d.getDate() === day && d >= today) return d;
  }
  return null;
}

function valid(date, month, day) {
  return date.getMonth() === month && date.getDate() === day;
}

/** Day-first numbers (20/10) everywhere except US English. */
function isDayFirst(locale) {
  return locale ? !/^en(?:[-_](?:US|PH|CA))?$/i.test(locale) : false;
}

/**
 * Find every date mentioned in `text`, relative to `ref` (the day it was said).
 * Options: `locale` (for example "en-US", "en-GB", "es", "pt-BR") decides how 10/11 is read.
 * Returns [{ date: "YYYY-MM-DD", index, end, match }] in order of appearance.
 * Past mentions ("last Friday") and recurring ones ("on Tuesdays") are left out.
 */
export function findDates(text, ref = new Date(), { locale } = {}) {
  const source = String(text);
  const today = startOfDay(ref);
  const dayFirst = isDayFirst(locale);
  const found = [];
  // rank: 3 a calendar date, 2 a relative day, 1 a weekday or a week
  const add = (date, index, match, rank, extra = {}) => {
    if (date) found.push({ date, index, end: index + match.length, match, rank, ...extra });
  };
  const all = (re) => source.matchAll(re);

  // ---- Calendar dates ----
  // "October 20", "Oct. 20th, 2026"
  for (const m of all(new RegExp(`\\b${EN_MONTH}\\.?\\s+${DAY}(?!\\d|:\\d)\\b(?:,?\\s+(\\d{4}))?`, "gi"))) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = Number(m[2]);
    const date = resolveYear(month, day, m[3] && Number(m[3]), today);
    if (valid(date, month, day)) add(date, m.index, m[0], 3);
  }
  // "20 October", "the 20th of October", "20 de octubre", "dia 20 de outubro", and lists: "4th and 5th November"
  for (const m of all(
    new RegExp(
      `(?<![\\d/])(?:(\\d{1,2}(?:st|nd|rd|th|º)?)\\s*(?:,|&|and|or|y|e|ou|o)\\s*(?:the\\s+|el\\s+|o\\s+)?)?${DAY}\\s+(?:of\\s+|de\\s+)?${ANY_MONTH}\\.?(?![${L}])(?:,?\\s+(?:de\\s+)?(\\d{4}))?`,
      "giu",
    ),
  )) {
    const month = MONTHS[fold(m[3])];
    if (month === undefined) continue;
    const year = m[4] && Number(m[4]);
    const second = m.index + m[0].indexOf(m[2], m[1] ? m[0].indexOf(m[1]) + m[1].length : 0);
    if (m[1]) {
      const n = parseInt(m[1], 10);
      const d1 = resolveYear(month, n, year, today);
      if (valid(d1, month, n)) add(d1, m.index, m[1], 3);
    }
    const d2 = resolveYear(month, Number(m[2]), year, today);
    if (valid(d2, month, Number(m[2])))
      add(d2, m[1] ? second : m.index, m[1] ? source.slice(second, m.index + m[0].length) : m[0], 3);
  }
  // "October third", "the twenty first of October"
  for (const m of all(new RegExp(`\\b${EN_MONTH}\\.?\\s+(?:the\\s+)?(${EN_ORD_RE})\\b`, "gi"))) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = ordinalValue(m[2]);
    const date = resolveYear(month, day, null, today);
    if (valid(date, month, day)) add(date, m.index, m[0], 3);
  }
  for (const m of all(new RegExp(`\\b(?:the\\s+)?(${EN_ORD_RE})\\s+of\\s+${EN_MONTH}\\b`, "gi"))) {
    const month = MONTHS[m[2].toLowerCase()];
    const day = ordinalValue(m[1]);
    const date = resolveYear(month, day, null, today);
    if (valid(date, month, day)) add(date, m.index, m[0], 3);
  }
  // Days said as words in Spanish and Portuguese: "dia vinte e cinco de novembro", "el quince de octubre"
  for (const m of all(new RegExp(`(?<![${L}])(${DAY_WORDS_RE})\\s+de\\s+${ANY_MONTH}(?![${L}])`, "giu"))) {
    const day = DAY_WORDS[fold(m[1]).replace(/\s+/g, " ")];
    const month = MONTHS[fold(m[2])];
    if (!day || month === undefined) continue;
    const date = resolveYear(month, day, null, today);
    if (valid(date, month, day)) add(date, m.index, m[0], 3);
  }
  // "dia catorze", "el quince": a day of the month said as a word (with "el", only 10 and up, since
  // "el dos" is more often "the two")
  for (const m of all(new RegExp(`(?<![${L}])(dia|el)\\s+(${DAY_WORDS_RE})(?![${L}])(?!\\s+de\\s)`, "giu"))) {
    const day = DAY_WORDS[fold(m[2]).replace(/\s+/g, " ")];
    if (!day || (/^el$/i.test(m[1]) && day < 10)) continue;
    add(nextDayOfMonth(today, day), m.index, m[0], 2.5);
  }
  // "10/20", "10/20/2026"; "20/10" outside the US
  for (const m of all(/(?<![\d/.])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/g)) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const first = dayFirst || a > 12;
    const month = (first ? b : a) - 1;
    const day = first ? a : b;
    if (month < 0 || month > 11) continue;
    const date = resolveYear(month, day, m[3] && Number(m[3]), today);
    if (valid(date, month, day)) add(date, m.index, m[0], 3);
  }
  // "the 3rd", "by the 20th", "on 4th"
  for (const m of all(
    new RegExp(
      `\\b(?:the|on|by|until|till|before|from|to|is|due)\\s+(\\d{1,2})(st|nd|rd|th)\\b(?!\\s+(?:of\\s+)?${EN_MONTH}\\b)(?!\\s+(?:${NOT_A_DAY})\\b)(?!\\s+(?:and|&|or)\\s+\\d)`,
      "gi",
    ),
  )) {
    const at = m.index + m[0].lastIndexOf(m[1]);
    add(nextDayOfMonth(today, Number(m[1])), at, source.slice(at, m.index + m[0].length), 2.5);
  }
  // "on the twentieth", "due the twenty first": only after a word that introduces a date, and not
  // before a noun ("the third chapter")
  for (const m of all(
    new RegExp(
      `\\b(?:on|by|until|till|before|due)\\s+the\\s+(${EN_ORD_RE})\\b(?!\\s+(?:of\\s+)?${EN_MONTH}\\b)(?![\\s-]+(?:${NOT_A_DAY}|\\p{L}+(?:s|ing|ed)\\b))`,
      "giu",
    ),
  )) {
    const at = m.index + m[0].toLowerCase().lastIndexOf("the");
    add(nextDayOfMonth(today, ordinalValue(m[1])), at, source.slice(at, m.index + m[0].length), 2.5);
  }
  // A weekday with a day number: "el jueves 22", "na quinta 22", "Thursday 22", "Friday the 23rd".
  // The weekday picks which month: the next day with that number that falls on that weekday.
  for (const m of all(
    new RegExp(
      `(?<![${L}])(${EN_DAY.slice(1, -1)}|mon|tues?|wed|thu(?:rs?)?|fri|sat|sun|domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|segunda|ter[çc]a|quarta|quinta|sexta)(?:-feira)?\\.?,?\\s+(?:the\\s+|el\\s+|dia\\s+)?(\\d{1,2})(?:st|nd|rd|th|º|°)?(?![\\d/:.,]\\d|\\s*(?:de\\s+|of\\s+)?${ANY_MONTH}|\\s*(?:%|am|pm|a\\.m|p\\.m|h\\b|hs\\b|horas|hours|minutes|minutos|students|alumnos|alunos|people|pages|p[aá]ginas|points|puntos|pontos|questions|preguntas|quest[õo]es|${NOT_A_DAY})(?![${L}]))`,
      "giu",
    ),
  )) {
    const weekday = WEEKDAYS[fold(m[1]).replace(/\.$/, "")];
    const n = Number(m[2]);
    if (weekday === undefined || n < 1 || n > 31) continue;
    let date = null;
    for (let i = 0; i < 12 && !date; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, n);
      if (d.getDate() === n && d >= today && d.getDay() === weekday) date = d;
    }
    add(date || nextDayOfMonth(today, n), m.index, m[0], 2.6);
  }
  // "dia 20", "el 20" (Portuguese and Spanish day of the month)
  for (const m of all(
    new RegExp(
      `(?<![${L}])(?:dia|el)\\s+(\\d{1,2})(?![\\d/%:.,]\\d|\\s*(?:de\\s+)?${ANY_MONTH}|\\s*%|\\s*(?:de\\s+)?(?:la|las|los)\\b)`,
      "giu",
    ),
  )) {
    if (Number(m[1]) > 31 || Number(m[1]) < 1) continue;
    add(nextDayOfMonth(today, Number(m[1])), m.index, m[0], 2.5);
  }

  // ---- Relative days ----
  for (const m of all(/\b(?:the\s+)?day after tomorrow\b/gi)) add(addDays(today, 2), m.index, m[0], 2);
  for (const m of all(/\b(today|tonight|tomorrow)\b/gi))
    add(m[1].toLowerCase() === "tomorrow" ? addDays(today, 1) : today, m.index, m[0], 2);
  for (const m of all(new RegExp(`\\b${COUNT}\\s+(days?|weeks?)\\s+from\\s+(today|now|tomorrow|${EN_DAY})\\b`, "gi"))) {
    const n = COUNTS[m[1].toLowerCase()] ?? Number(m[1]);
    const base = /today|now/i.test(m[3])
      ? today
      : /tomorrow/i.test(m[3])
        ? addDays(today, 1)
        : upcoming(today, WEEKDAYS[m[3].toLowerCase()]);
    add(addDays(base, /^week/i.test(m[2]) ? n * 7 : n), m.index, m[0], 2.2);
  }
  for (const m of all(new RegExp(`\\b(?:in|within)\\s+${COUNT}\\s+(days?|weeks?)\\b`, "gi"))) {
    const n = COUNTS[m[1].toLowerCase()] ?? Number(m[1]);
    add(addDays(today, /^week/i.test(m[2]) ? n * 7 : n), m.index, m[0], 2);
  }
  // British: "a fortnight today", "in a fortnight", "a week on Friday", "a week tomorrow"
  for (const m of all(
    new RegExp(
      `\\b(?:in\\s+)?a\\s+(fortnight|week)\\s+(?:(today|tomorrow|from\\s+today|from\\s+tomorrow)|on\\s+${EN_DAY})\\b`,
      "gi",
    ),
  )) {
    const span = m[1].toLowerCase() === "fortnight" ? 14 : 7;
    const base = m[3]
      ? upcoming(today, WEEKDAYS[m[3].toLowerCase()])
      : /tomorrow/i.test(m[2])
        ? addDays(today, 1)
        : today;
    add(addDays(base, span), m.index, m[0], 2.2);
  }
  for (const m of all(/\bin\s+a\s+fortnight\b|\bfortnight\s+from\s+now\b/gi)) add(addDays(today, 14), m.index, m[0], 2);
  // "end of the month", "a fin de mes", "no fim do mês": its last day
  for (const m of all(
    new RegExp(
      `(?<![${L}])(?:(?:the\\s+)?end of (?:the |this )?month|(?:a\\s+|al\\s+)?fin(?:al)?\\s+de(?:l)?\\s+mes|(?:no\\s+|o\\s+|até\\s+o\\s+)?(?:fim|final)\\s+do\\s+m[êe]s)(?![${L}])`,
      "giu",
    ),
  )) {
    add(new Date(today.getFullYear(), today.getMonth() + 1, 0), m.index, m[0], 1.6);
  }
  for (const m of all(/\b(?:the\s+)?end of (?:the |this )?week\b/gi)) add(endOfWeek(today), m.index, m[0], 1.5);
  for (const m of all(/\bend of next week\b/gi)) add(nextWeek(today, 5), m.index, m[0], 1.6);
  for (const m of all(/\bnext week(?:'s)?\b/gi)) add(nextWeek(today, 1), m.index, m[0], 1.2, { week: true });
  // Spanish
  for (const m of all(new RegExp(`(?<![${L}])(pasado\\s+mañana|hoy|esta\\s+noche|mañana)(?![${L}])`, "giu"))) {
    const word = m[1].toLowerCase();
    const before = source.slice(Math.max(0, m.index - 8), m.index).toLowerCase();
    if (word === "mañana" && /(?:la|esta|una|cada|por|de)\s*$/.test(before)) continue;
    add(addDays(today, word.startsWith("pasado") ? 2 : word === "mañana" ? 1 : 0), m.index, m[0], 2);
  }
  for (const m of all(
    new RegExp(
      `(?<![${L}])(?:en|dentro\\s+de|daqui\\s+a|em|daqui)\\s+${COUNT}\\s+(d[ií]as?|semanas?)(?![${L}])`,
      "giu",
    ),
  )) {
    const n = COUNTS[m[1].toLowerCase()] ?? Number(m[1]);
    add(addDays(today, /^semana/i.test(m[2]) ? n * 7 : n), m.index, m[0], 2);
  }
  for (const m of all(
    new RegExp(
      `(?<![${L}])(?:la\\s+)?(?:semana\\s+que\\s+viene|pr[oó]xima\\s+semana|semana\\s+pr[oó]xima|otra\\s+semana)(?![${L}])`,
      "giu",
    ),
  ))
    add(nextWeek(today, 1), m.index, m[0], 1.2, { week: true });
  // Portuguese
  for (const m of all(new RegExp(`(?<![${L}])(depois\\s+de\\s+amanh[ãa]|hoje|amanh[ãa])(?![${L}])`, "giu"))) {
    const word = fold(m[1]);
    const before = source.slice(Math.max(0, m.index - 6), m.index).toLowerCase();
    if (word === "amanha" && /\bde\s*$/.test(before)) continue;
    add(addDays(today, word.startsWith("depois") ? 2 : word === "amanha" ? 1 : 0), m.index, m[0], 2);
  }
  for (const m of all(
    new RegExp(`(?<![${L}])(?:a\\s+)?(?:semana\\s+que\\s+vem|pr[oó]xima\\s+semana)(?![${L}])`, "giu"),
  ))
    add(nextWeek(today, 1), m.index, m[0], 1.2, { week: true });
  for (const m of all(
    new RegExp(
      `(?<![${L}])(?:o\\s+)?(?:fim|final)\\s+(?:da|de)\\s+semana(?![${L}])|(?<![${L}])(?:el\\s+)?fin\\s+de\\s+(?:la\\s+)?semana(?![${L}])`,
      "giu",
    ),
  )) {
    if (/fin de semana/i.test(m[0]) && !/fin de la semana/i.test(m[0])) continue; // "fin de semana" is the weekend
    add(endOfWeek(today), m.index, m[0], 1.5);
  }

  // ---- Weekdays ----
  // English: "Friday", "on Friday", "this Friday", "next Friday", "Friday next week", "the Tuesday after that", "Tues."
  for (const m of all(
    new RegExp(
      `\\b(?:(next|this coming|this|coming|on|by|until|till|before|for|last|past|the)\\s+)?${EN_DAY}(?!s\\b)\\b(\\s+(?:after\\s+(?:that|next)|next\\s+week|the\\s+week\\s+after|week(?![${L}'])))?`,
      "giu",
    ),
  )) {
    const word = (m[1] || "").toLowerCase();
    if (word === "last" || word === "past") continue;
    const target = WEEKDAYS[m[2].toLowerCase()];
    const tail = (m[3] || "").toLowerCase();
    const date =
      word === "next" || /next week/.test(tail)
        ? nextWeek(today, target)
        : tail
          ? addDays(upcoming(today, target), 7)
          : upcoming(today, target);
    add(date, m.index, m[0], tail ? 1.3 : 1, {
      weekday: target,
      bare: !word || /^(this coming|this|coming|on|by|until|till|before|for|the)$/.test(word) ? !tail : false,
    });
  }
  // "the Tuesday after half term", "the Monday after Thanksgiving": the date depends on a school
  // calendar Seekto doesn't know, so it isn't guessed
  const HOLIDAY =
    /^\s+(?:after|before)\s+(?:the\s+)?(?:half[- ]term|break|spring break|winter break|fall break|reading week|holidays?|vacation|thanksgiving|easter|christmas|diwali|carnival|carnaval|semana santa|the long weekend|long weekend|exams|midterms|finals)\b/i;
  found.splice(
    0,
    found.length,
    ...found.filter((f) => !(f.weekday !== undefined && HOLIDAY.test(source.slice(f.end)))),
  );
  for (const m of all(/\b(mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\.(?=[\s,])/gi))
    add(upcoming(today, WEEKDAYS[m[1].toLowerCase()]), m.index, m[0], 1, {
      weekday: WEEKDAYS[m[1].toLowerCase()],
      abbr: true,
    });
  // Spanish: "el viernes", "el próximo martes", "el jueves que viene", "el viernes de la próxima semana"
  for (const m of all(
    new RegExp(
      `(?<![${L}])((?:(?:el|este|para el|hasta el|del|al)\\s+)?(pr[oó]ximo\\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(\\s+(?:de\\s+la\\s+(?:pr[oó]xima\\s+semana|semana\\s+que\\s+viene)|que\\s+viene|pasado))?)(?![${L}])`,
      "giu",
    ),
  )) {
    if (/pasado/i.test(m[4] || "")) continue;
    const target = WEEKDAYS[fold(m[3])];
    const next = m[2] || m[4];
    add(next ? nextWeek(today, target) : upcoming(today, target), m.index, m[0], m[4] ? 1.3 : 1, {
      weekday: target,
      bare: !next,
    });
  }
  // Portuguese: "na sexta", "sexta-feira que vem", "na próxima terça", "na outra sexta"
  for (const m of all(
    new RegExp(
      `(?<![${L}])(?:(na|no|de|até|ate|pra|para|essa|esta|nessa|nesta|toda|todo|a partir de)\\s+)?(?:(pr[oó]xim[ao]|outra)\\s+)?(segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado|domingo)(-feira)?(\\s+(?:que\\s+vem|passad[oa]))?(?![${L}-])`,
      "giu",
    ),
  )) {
    const [, prep, next, name, feira, tail] = m;
    if (/passad/i.test(tail || "") || /^tod/i.test(prep || "")) continue;
    // "segunda" and "quarta" also mean "second" and "fourth": only count them with "-feira" or a preposition
    if (!feira && !prep && !next && !tail && !/^(s[aá]bado|domingo)$/i.test(name)) continue;
    const target = WEEKDAYS[fold(name)];
    add(next || tail ? nextWeek(today, target) : upcoming(today, target), m.index, m[0], 1, {
      weekday: target,
      bare: !next && !tail,
    });
  }

  // ---- Clean up ----
  found.sort((a, b) => a.index - b.index || b.rank - a.rank || b.end - a.end);
  // Overlaps: keep the stronger, then the longer match ("the day after tomorrow" over "tomorrow").
  let kept = [];
  for (const f of found) {
    const clash = kept.find((k) => f.index < k.end && k.index < f.end);
    if (!clash) {
      kept.push(f);
      continue;
    }
    if (f.rank > clash.rank || (f.rank === clash.rank && f.end - f.index > clash.end - clash.index))
      kept[kept.indexOf(clash)] = f;
  }
  kept.sort((a, b) => a.index - b.index);
  // A weekday right before a calendar date is part of it: "Monday 9 November", "Tues., Nov. 3".
  kept = kept.filter(
    (k, i) =>
      !(
        k.weekday !== undefined &&
        kept[i + 1]?.rank >= 2.5 &&
        /^[\s,.]*(?:the\s+)?$/i.test(source.slice(k.end, kept[i + 1].index))
      ),
  );
  // "next week" next to a weekday moves that weekday into next week: "next week's quiz is on Wednesday".
  for (const w of kept.filter((k) => k.week)) {
    const near = kept.filter(
      (k) =>
        k.bare &&
        Math.abs(k.index - w.index) < 60 &&
        !/[.!?]/.test(source.slice(Math.min(k.end, w.end), Math.max(k.index, w.index))),
    );
    if (!near.length) continue;
    for (const k of near) k.date = nextWeek(today, k.weekday);
    w.drop = true;
  }
  // Dates said relative to the one before: "the 3rd, and the slides are due the day before",
  // "el 4 de diciembre y el coloquio una semana después", "a P2 ... e a substitutiva uma semana depois"
  const RELATIVE = new RegExp(
    `(?<![${L}])(?:(a|one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2}|una|dos|uma|duas)\\s+(days?|weeks?|d[ií]as?|semanas?)\\s+(?:later|after(?:wards)?|after that|despu[eé]s|m[aá]s tarde|depois)|the day (before|after)|el d[ií]a (anterior|siguiente)|o dia (anterior|seguinte))(?![${L}])`,
    "giu",
  );
  for (const m of source.matchAll(RELATIVE)) {
    const prev = [...kept].reverse().find((k) => !k.drop && k.end <= m.index);
    if (!prev || kept.some((k) => m.index < k.end && k.index < m.index + m[0].length)) continue;
    const delta = m[2]
      ? (COUNTS[m[1].toLowerCase()] || Number(m[1]) || 1) * (/^w|^s/i.test(m[2]) ? 7 : 1)
      : /before|anterior/i.test(m[0])
        ? -1
        : 1;
    kept.push({ date: addDays(prev.date, delta), index: m.index, end: m.index + m[0].length, match: m[0] });
  }
  kept.sort((a, b) => a.index - b.index);
  return kept.filter((k) => !k.drop).map(({ date, index, end, match }) => ({ date: toISO(date), index, end, match }));
}

// ---------- Sentences ----------
const ABBR =
  /\b(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|pp|p|no|nos|vs|ch|sec|vol|fig|ex|approx|dr|mr|mrs|ms|prof|st)\.$/i;

/** Split text into sentences. Lines and "|" separate too, so schedules split per row. */
export function sentences(text) {
  const out = [];
  for (const line of String(text).split(/\n+|\s\|\s/)) {
    const parts = line.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9"'¿¡ÁÉÍÓÚÑ])/);
    for (const p of parts) {
      const s = p.trim();
      if (!s) continue;
      if (out.length && ABBR.test(out[out.length - 1]) && /^[\dA-Z]/.test(s) && !/[!?]$/.test(out[out.length - 1]))
        out[out.length - 1] += ` ${s}`;
      else out.push(s);
    }
  }
  return out;
}

// ---------- Events ----------
// Event words, most specific first; the first match decides the type. "romance" words take
// their title from the words after them ("examen de química"), English ones from the words before.
const EVENT_WORDS = [
  ["mid-term", "test"],
  ["midterm", "test"],
  ["controlled assessment", "test"],
  ["internal assessment", "test"],
  ["assessment", "test"],
  ["cia", "test"],
  ["lab record", "assignment"],
  ["final exam", "test"],
  ["mock exam", "test"],
  ["fee", "assignment"],
  ["last date", "assignment"],
  ["final project", "assignment"],
  ["final paper", "assignment"],
  ["final essay", "assignment"],
  ["final reflection", "assignment"],
  ["final presentation", "assignment"],
  ["final", "test"],
  ["exam", "test"],
  ["retest", "test"],
  ["re-test", "test"],
  ["test", "test"],
  ["quiz", "test"],
  ["mock", "test"],
  ["viva voce", "test"],
  ["viva", "test"],
  ["internals", "test"],
  ["internal", "test"],
  ["practical", "test"],
  ["mid-sem", "test"],
  ["end-sem", "test"],
  ["sessional", "test"],
  ["essay", "assignment"],
  ["paper", "assignment"],
  ["project", "assignment"],
  ["homework", "assignment"],
  ["coursework", "assignment"],
  ["problem set", "assignment"],
  ["pset", "assignment"],
  ["worksheet", "assignment"],
  ["assignment", "assignment"],
  ["lab report", "assignment"],
  ["write-up", "assignment"],
  ["lab", "assignment"],
  ["report", "assignment"],
  ["presentation", "assignment"],
  ["proposal", "assignment"],
  ["synopsis", "assignment"],
  ["reflection", "assignment"],
  ["response", "assignment"],
  ["draft", "assignment"],
  ["reading", "assignment"],
  ["forum", "assignment"],
  ["discussion post", "assignment"],
  ["submission", "assignment"],
  ["sign up", "assignment"],
  ["deadline", "assignment"],
  ["submitted", "assignment"],
  ["submit", "assignment"],
  ["hand in", "assignment"],
  ["handed in", "assignment"],
  ["turn in", "assignment"],
  ["turned in", "assignment"],
  ["read", "assignment"],
  ["due", "assignment"],
  ["permission slips", "assignment"],
  ["permission slip", "assignment"],
  ["forms", "assignment"],
  ["uploaded", "assignment"],
  ["upload", "assignment"],
  ["field trip", "event"],
  ["school trip", "event"],
  ["museum trip", "event"],
  ["excursion", "event"],
  ["picture day", "event"],
  ["photo day", "event"],
  // Spanish
  ["examen parcial", "test", 1],
  ["examen extraordinario", "test", 1],
  ["extraordinario", "test", 1],
  ["examen final", "test", 1],
  ["examen", "test", 1],
  ["parcial", "test", 1],
  ["prueba", "test", 1],
  ["control", "test", 1],
  ["simulacro", "test", 1],
  ["recuperatorio", "test", 1],
  ["cuestionario", "test", 1],
  ["evaluación", "test", 1],
  ["ensayo", "assignment", 1],
  ["trabajo", "assignment", 1],
  ["proyecto", "assignment", 1],
  ["tarea", "assignment", 1],
  ["deberes", "assignment", 1],
  ["informe", "assignment", 1],
  ["reporte", "assignment", 1],
  ["laboratorio", "assignment", 1],
  ["presentación", "assignment", 1],
  ["exposición", "assignment", 1],
  ["lectura", "assignment", 1],
  ["foro", "assignment", 1],
  ["actividad", "assignment", 1],
  ["ejercicios", "assignment", 1],
  ["entrega", "assignment", 1],
  ["entregar", "assignment", 1],
  ["fecha límite", "assignment", 1],
  // Portuguese
  ["prova substitutiva", "test", 1],
  ["prova", "test", 1],
  ["provinha", "test", 1],
  ["p1", "test", 1],
  ["p2", "test", 1],
  ["p3", "test", 1],
  ["p4", "test", 1],
  ["av1", "test", 1],
  ["av2", "test", 1],
  ["av3", "test", 1],
  ["teste", "test", 1],
  ["simulado", "test", 1],
  ["avaliação", "test", 1],
  ["recuperação", "test", 1],
  ["trabalho", "assignment", 1],
  ["seminário", "assignment", 1],
  ["relatório", "assignment", 1],
  ["lista de exercícios", "assignment", 1],
  ["lista", "assignment", 1],
  ["exercício", "assignment", 1],
  ["resenha", "assignment", 1],
  ["apresentação", "assignment", 1],
  ["projeto", "assignment", 1],
  ["atividade", "assignment", 1],
  ["redação", "assignment", 1],
  ["redacao", "assignment", 1],
  ["dever de casa", "assignment", 1],
  ["dever", "assignment", 1],
  ["leitura", "assignment", 1],
  ["fórum", "assignment", 1],
  // from KeuqS's Portuguese support (#11)
  ["exame", "test", 1],
  ["ensaio", "assignment", 1],
  ["tarefa", "assignment", 1],
  ["prazo", "assignment", 1],
  ["excursión", "event", 1],
  ["subir", "assignment", 1],
  ["subirla", "assignment", 1],
  ["subirlo", "assignment", 1],
  ["excursão", "event", 1],
  ["salida de campo", "event", 1],
  ["coloquio", "test", 1],
  ["práctica", "assignment", 1],
];
const EVENT_RES = EVENT_WORDS.map(([word, type, romance]) => [
  new RegExp(`(?<![${L}])${word}(?:s|es)?(?![${L}])`, "iu"),
  word,
  type,
  !!romance,
]);

// romanceFirst: in Spanish or Portuguese speech, "relatório do lab" is a relatório, not a lab
function eventWord(text, romanceFirst = false) {
  const order = romanceFirst ? [...EVENT_RES.filter((e) => e[3]), ...EVENT_RES.filter((e) => !e[3])] : EVENT_RES;
  for (const [re, word, type, romance] of order) {
    const m = text.match(re);
    if (m) return { word, type, romance, index: m.index, text: m[0] };
  }
  return null;
}

// Clues around a date
const NEGATION = new RegExp(
  `(?:^|[\\s(])(?:no|not|n[ãa]o|nunca|nem|isn't|aren't|won't|wasn't|there's no|sin)(?![${L}'])`,
  "iu",
);
// "Mañana no, pasado mañana", "Friday, no, Thursday", "na sexta não."
const NEGATED_AFTER = /^\s*,?\s*(?:no|not|n[ãa]o)\s*(?:[,.;!?]|$)/iu;
const PAST = new RegExp(`(?<![${L}])(?:was|were|had|took|fue|era|ia|iba|tuvimos|foi|tivemos|teve)(?![${L}])`, "iu");
const RESCHEDULE = new RegExp(
  `(?<![${L}])(?:mov(?:ed|ing|e)|push(?:ed|ing)?(?: it| that)? back|postpon(?:ed|ing|e)|extend(?:ed|ing)?|resched(?:uled|uling)|changed|bump(?:ed|ing)?|instead|giving (?:you|everybody|everyone|you all)(?: guys)? until|pas[óo]|cambi[óo]|movi(?:mos|ó)|aplaz(?:ó|amos|ado)|pospu?s|adiad[oa]|adiamos|mudou|mudamos|transferid[oa]|ficou para|fica para|vai ser|vai ficar|passou|passa|se pasa|se cambia|se mueve|is now|are now|it's now|now it's|now it is|ahora es|agora é|agora vai)(?![${L}])|it's on [^,.]{2,24} now(?![${L}])`,
  "iu",
);
const CANCELLED = new RegExp(
  `(?<![${L}])(?:cancel+(?:ed|led)?|skip(?:ping|ped)?|called off|scrapp(?:ed|ing)|cancelad[oa]s?|suspendid[oa]|no va a haber|n[ãa]o vai (?:ter|haver)|n[ãa]o tem mais)(?![${L}])`,
  "iu",
);
const CORRECTION =
  /(?:^|[,.;]\s*|\s)(?:no,|no wait|wait|sorry|i mean|actually|rather|correction|scratch that|perd[oó]n|digo|mejor dicho|desculp[ae]|quer dizer|ou melhor)(?![\p{L}])/giu;
// Things that come with a date but aren't something to prepare for or hand in.
const NOT_DUE = new RegExp(
  `(?<![${L}])(?:grades?(?!\\s+(?:\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|k\\b))|report cards?|marks|results?|resultados?|notas|feedback|comments|come back|comes back|coming back|get (?:them|it|those|these) back|give (?:them|it|you|those) back|hand(?:ing)? (?:them|it|those) back|hand back|return(?:ed|ing)?|distribut(?:e|ing)|discuss(?:ing)?|go over|going over|go(?:es)? out|will go out|post(?:ing)? the|grad(?:e|ing) (?:them|it|those)|sai o|saem|discut(?:e|ir|imos)|devuelvo|devolvo|devolver|devolvemos|corrigi|corrijo|corregir|corregimos|corrige|corrigir|corrigimos|office hours)(?![${L}])`,
  "iu",
);
const GRADES =
  /(?<![\p{L}])(?:grades?(?!\s+(?:\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|k\b))|marks|results?|resultados?|notas)(?![\p{L}])/iu;
const DUE_CUE = /(?<![\p{L}])(?:due|submit|hand in|turn in|entrega|entregar|se entrega)(?![\p{L}])/iu;
const ELLIPTICAL_NEXT =
  /(?<![\p{L}])(?:el|la|o|a)\s+(?:pr[oó]xim[oa]|outr[oa])\s*[.,!?]*\s*$|(?<![\p{L}])the (?:next|following) one\b/iu;

/** The clause around a position: between commas, "and", "but", "then". */
function clauseAt(text, index) {
  const SEP = /[,;:|]|\s(?:and|but|then|so|y|pero|e|mas|ent[ãa]o)\s/giu;
  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(SEP)) {
    if (m.index + m[0].length <= index) start = m.index + m[0].length;
    else if (m.index >= index) {
      end = m.index;
      break;
    }
  }
  return text.slice(start, end);
}

/** Words between the last punctuation mark and a position. */
function leadIn(text, index) {
  const before = text.slice(0, index);
  const cut = Math.max(
    before.lastIndexOf(","),
    before.lastIndexOf(";"),
    before.lastIndexOf("."),
    before.lastIndexOf("?"),
    before.lastIndexOf("!"),
  );
  return before.slice(cut + 1);
}

function isNegated(text, d) {
  let lead = leadIn(text, d.index).split(/\s+/).slice(-6).join(" ");
  // Portuguese "no" before a day is "on the": "a prova é no sábado", "no dia 20"
  if (
    /(?:^|\s)no\s*$/i.test(lead) &&
    /^(?:dia|s[aá]bado|domingo|segunda|ter[çc]a|quarta|quinta|sexta|\d|fim|final|pr[oó]ximo)/i.test(d.match)
  )
    lead = lead.replace(/no\s*$/i, "");
  lead = lead.replace(/(^|\s)no(?=\s+(?:dia|pr[oó]xim[oa]|fim|final|come[cç]o|in[ií]cio)\b)/giu, "$1");
  if (NEGATION.test(lead) && !/no (?:later|more) than|not (?:later|after) than/i.test(lead)) return true;
  return NEGATED_AFTER.test(text.slice(d.end, d.end + 8));
}

function isPast(text, d) {
  const lead = leadIn(text, d.index);
  const m = lead.match(new RegExp(`${PAST.source}(?![\\s\\S]*${PAST.source})`, "iu"));
  if (!m) return false;
  const after = lead.slice(m.index);
  return !RESCHEDULE.test(after) && !/(?<![\p{L}])(?:will|'ll|going to|gonna|vai|va a)(?![\p{L}])/iu.test(after);
}

/** Pick the dates a part of a sentence really means. */
function pickDates(part, dates, hit) {
  const ok = (d) => {
    if (isNegated(part, d) || isPast(part, d)) return false;
    const clause = clauseAt(part, d.index);
    return !GRADES.test(clause) && (!NOT_DUE.test(clause) || DUE_CUE.test(clause));
  };
  const live = dates.filter(ok);
  // "There's no quiz Friday, it's the next one" / "na outra"
  if (!live.length && dates.length && ELLIPTICAL_NEXT.test(part)) {
    const last = dates[dates.length - 1];
    return [{ ...last, date: toISO(addDays(fromISO(last.date), 7)) }];
  }
  if (!live.length) return [];
  // Corrections: "Wednesday, no, Thursday", "the 6th. No, wait, the 7th". The first date after the first
  // correction that follows a date wins.
  for (const c of part.matchAll(CORRECTION)) {
    const before = dates.filter((d) => d.index < c.index).pop();
    if (!before) continue;
    const after = live.find((d) => d.index > c.index);
    // "el 15 de noviembre, no, perdón, el 16": a bare day corrects only the day, so it keeps the month
    if (
      after &&
      /^(?:(?:el|dia|the|on the)\s+)?\d{1,2}(?:st|nd|rd|th|º)?$/i.test(after.match.trim()) &&
      /[\p{L}]{3,}|\//u.test(before.match.replace(/^(?:el|dia|the|on the)\s+/i, ""))
    ) {
      const day = Number(after.match.match(/\d{1,2}/)[0]);
      const [y, m] = before.date.split("-").map(Number);
      const fixed = new Date(y, m - 1, day);
      if (fixed.getMonth() === m - 1) return [{ ...after, date: toISO(fixed) }];
    }
    if (after) return [after];
    break;
  }
  // Reschedules: "from Monday to the 12th", "del viernes al martes", or "moved to next Tuesday".
  for (let i = 0; i + 1 < dates.length; i++) {
    // Spanish matches can start with "del"/"al": "del viernes al martes"
    const between =
      `${part.slice(dates[i].end, dates[i + 1].index)} ${dates[i + 1].match.match(/^(?:al|a|para|pra|at[ée]|hasta)\s/i)?.[0] || ""}`.replace(
        /\s+/g,
        " ",
      );
    const before = `${part.slice(Math.max(0, dates[i].index - 12), dates[i].index)}${dates[i].match.match(/^(?:del|de|desde|do|da)\s/i)?.[0] || ""}`;
    if (
      /^\s*,?\s*(?:to|until|till|al|a|para|pra|pro|at[ée]|hasta)\s+(?:the\s+|el\s+|la\s+|o\s+|a\s+|na\s+|no\s+)?$/i.test(
        between.replace(/\s+$/, " "),
      ) &&
      /(?:from|del|de|desde|do|da|of)\s+(?:the\s+|el\s+|la\s+|a\s+|o\s+)?$/i.test(before)
    )
      return [dates[i + 1]];
  }
  const resched = part.match(RESCHEDULE);
  if (resched) {
    const after = live.filter((d) => d.index > resched.index);
    if (after.length) return [after[0]];
  }
  // Lists: "on Thursday and Friday", "4th and 5th November"
  const first = live.find((d) => d.index >= hit.index) || live[live.length - 1];
  const picked = [first];
  for (let i = live.indexOf(first); i + 1 < live.length; i++) {
    if (
      /^\s*(?:,|and|&|or|y|e|ou)\s*(?:on\s+|the\s+|el\s+|na\s+|no\s+)?$/i.test(
        part.slice(live[i].end, live[i + 1].index),
      )
    )
      picked.push(live[i + 1]);
    else break;
  }
  return picked;
}

const TITLE_SKIP = new Set([
  "o",
  "os",
  "as",
  "el",
  "la",
  "los",
  "las",
  "the",
  "a",
  "an",
  "our",
  "your",
  "my",
  "their",
  "his",
  "her",
  "this",
  "that",
  "is",
  "are",
  "will",
  "be",
  "and",
  "so",
  "next",
  "big",
  "on",
  "um",
  "uh",
  "like",
  "okay",
  "ok",
  "also",
  "then",
  "don't",
  "forget",
  "remember",
  "just",
  "itself",
  "whole",
  "first",
  "second",
]);
const ROMANCE_STOP = new Set([
  "es",
  "será",
  "sera",
  "se",
  "va",
  "hay",
  "para",
  "el",
  "la",
  "los",
  "las",
  "este",
  "esta",
  "que",
  "y",
  "en",
  "vence",
  "tiene",
  "tienen",
  "hasta",
  "antes",
  "lo",
  "a",
  "hoy",
  "mañana",
  "pasado",
  "dentro",
  "lunes",
  "martes",
  "miércoles",
  "miercoles",
  "jueves",
  "viernes",
  "sábado",
  "sabado",
  "domingo",
  "próximo",
  "proximo",
  "próxima",
  "proxima",
  "eh",
  "pues",
  "bueno",
  "cierra",
  "hace",
  "pasó",
  "é",
  "vai",
  "ser",
  "tem",
  "uma",
  "una",
  "un",
  "um",
  "después",
  "despues",
  "semanas",
  "anterior",
  "siguiente",
  "seguinte",
  "pra",
  "o",
  "os",
  "as",
  "no",
  "na",
  "nos",
  "nas",
  "e",
  "em",
  "até",
  "hoje",
  "amanhã",
  "depois",
  "daqui",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "semana",
  "dia",
  "vocês",
  "gente",
  "tá",
  "né",
  "entregam",
  "mandam",
  "me",
  "então",
  "só",
  "mais",
  "foi",
  "fica",
  "ficou",
  "sai",
  "pelo",
  "pela",
  "tipo",
  "não",
  "nao",
  "já",
  "ja",
  "ya",
  "ahora",
  "agora",
  "passou",
  "pasó",
  "mudou",
]);

/** Spanish and Portuguese titles name the thing after the event word: "el examen de química es el viernes" -> "Examen de química". */
function romanceTitle(sentence, hit, subject) {
  const after = sentence.slice(hit.index).split(/\s+/).filter(Boolean);
  const words = [after[0].replace(/[^\p{L}\d'-]/gu, "")];
  // "el primer parcial" -> "Primer parcial"
  const ordinal = sentence
    .slice(0, hit.index)
    .match(
      /(?<![\p{L}])(primer|primero|primera|segundo|segunda|tercer|tercero|tercera|cuarto|cuarta|último|última|ultimo|ultima)\s+$/iu,
    );
  if (ordinal) words.unshift(ordinal[1]);
  for (let i = 1; i < after.length && words.length < 5; i++) {
    const w = after[i].replace(/[^\p{L}\d'-]/gu, "");
    if (!w || ROMANCE_STOP.has(w.toLowerCase()) || /[.,;:!?]$/.test(after[i - 1]) || /^\d+\/\d+/.test(w)) break;
    words.push(w);
  }
  while (words.length > 1 && /^(de|del|do|da|sobre)$/i.test(words[words.length - 1])) words.pop();
  return withSubject(capitalize(words.join(" ")), subject, ": ");
}

function withSubject(name, subject, sep = " ") {
  return subject && !name.toLowerCase().includes(subject.toLowerCase()) ? `${subject}${sep}${name}` : name;
}

function titleFor(sentence, hit, subject) {
  // "la tenéis que subir antes del 2": a verb, so the title is just "Entrega"
  if (hit.romance && /^subir/i.test(hit.word)) return withSubject("Entrega", subject, ": ");
  if (hit.romance) return romanceTitle(sentence, hit, subject);
  if (hit.word === "read") {
    const words = sentence
      .slice(hit.index)
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\d_'.-]/gu, ""))
      .filter(Boolean);
    const out = [];
    for (const w of words) {
      if (out.length && /^(for|by|before|on|until|tonight|tomorrow)$/i.test(w)) break;
      out.push(w);
      if (out.length >= 6) break;
    }
    return capitalize(out.join(" "));
  }
  const due = sentence.toLowerCase().search(/\b(due|deadline)\b/);
  const named = hit;
  if (due >= 0 && hit.type === "assignment" && !/fee|last date/.test(hit.word))
    hit = { ...hit, word: "due", index: due };
  if (/^(?:upload|uploaded)$/.test(hit.word)) hit = { ...hit, word: "due" };
  if (hit.word === "due" || hit.word === "deadline") {
    // "the lab write-up is due Friday" -> words before "due"
    const before = sentence.slice(0, hit.index).split(/\s+/).filter(Boolean);
    const words = [];
    for (let i = before.length - 1; i >= 0 && words.length < 4; i--) {
      const w = before[i].replace(/[^\p{L}\d_'-]/gu, "");
      if (!w) continue;
      if (TITLE_SKIP.has(w.toLowerCase()) || /^(needs?|to|be|has|have|it|that|which|was|were|for|of)$/i.test(w)) {
        if (words.length) break;
        continue;
      }
      if (/[,;:]$/.test(before[i]) && words.length) break;
      words.unshift(w);
    }
    // "the essay on the French Revolution is due" -> "Essay on the French Revolution due"
    const lead = sentence
      .slice(0, hit.index)
      .match(
        new RegExp(
          `(?<![\\p{L}])(essay|paper|report|project|presentation|assignment|worksheet|response|reflection|write-up|proposal|poster)\\s+(on|about|for)\\s+(the\\s+)?${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+")}`,
          "iu",
        ),
      );
    if (words.length && lead) words.unshift(lead[1].toLowerCase(), lead[2].toLowerCase(), ...(lead[3] ? ["the"] : []));
    // "Homework: finish questions 1 to 5, due Monday" -> "Homework due", not "5 due"
    if (!words.some((w) => /\p{L}/u.test(w)))
      words.splice(0, words.length, ...(named.word !== "due" && named.word !== "deadline" ? [named.text] : []));
    return capitalize(`${withSubject(words.length ? words.join(" ") : "Assignment", subject)} due`);
  }
  // Up to three meaningful words before the event word: "chapter 5 quiz"
  const before = sentence.slice(0, hit.index).split(/\s+/).filter(Boolean);
  const lead = [];
  for (let i = before.length - 1; i >= 0 && lead.length < 3; i--) {
    const w = before[i].replace(/[^\p{L}\d_'-]/gu, "");
    if (
      !w ||
      /[,;:]$/.test(before[i]) ||
      TITLE_SKIP.has(w.toLowerCase()) ||
      /^(on|by|for|of|in|at|to|have|has|we|you|there|there's|got|we've|i|'s)$/i.test(w) ||
      /'s$/.test(w)
    )
      break;
    lead.unshift(w);
  }
  // "the quiz on chapter 3 is next Thursday" -> "Quiz on chapter 3"
  const about = sentence
    .slice(hit.index + hit.text.length)
    .match(
      /^\s+(on|about|over|covering)\s+((?:the\s+)?[\p{L}\d'-]+(?:\s+[\p{L}\d'-]+){0,3}?)(?=\s+(?:is|are|was|will|this|next|due|on|by|tomorrow|today)\b|[,.;!?]|$)/iu,
    );
  const topic =
    about &&
    !findDates(about[2]).length &&
    !/(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(about[2])
      ? ` ${about[1].toLowerCase()} ${about[2]}`
      : "";
  return capitalize(withSubject([...lead, hit.text].join(" ") + topic, subject));
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Join a sentence that corrects the one before it: "The test is the 6th. No, wait, the 7th." */
function withCorrections(list) {
  const out = [];
  for (const s of list) {
    if (
      out.length &&
      /^(?:no,|no wait|no\.|sorry|wait|actually,|i mean|perd[oó]n|desculp[ae]|quer dizer)(?![\p{L}])/iu.test(s)
    )
      out[out.length - 1] += ` ${s}`;
    else out.push(s);
  }
  return out;
}

/** Split a sentence that holds several deadlines into one part per deadline: [{ text, start }]. */
function splitDeadlines(sentence, all) {
  // ("vinte e dois", "treinta y uno" are one number, not two clauses)
  const clauses = sentence
    .split(/(?<=[,;])\s+|(?<!(?:vinte|trinta|veinte|treinta))\s+(?=(?:and|but|then|plus|y|pero|e|mas)\s)/i)
    .filter((c) => c.trim());
  const chunks = [];
  let current = "";
  let start = 0;
  let pos = 0;
  for (const c of clauses) {
    const at = sentence.indexOf(c, pos);
    pos = at + c.length;
    if (!current) start = at;
    current = current ? `${current} ${c}` : c;
    const elliptical =
      chunks.length && /^(?:and|y|e)\s+(?:the|el|la|o|a)\s+(?!other|otr|outr)[\p{L}]+\s/iu.test(current);
    if ((eventWord(current) || elliptical) && all.some((d) => d.index >= start && d.index < pos)) {
      chunks.push({ text: sentence.slice(start, pos), start });
      current = "";
    }
  }
  if (current && chunks.length) chunks[chunks.length - 1].text = sentence.slice(chunks[chunks.length - 1].start);
  return chunks.length > 1 ? chunks : [{ text: sentence, start: 0 }];
}

/**
 * Find tests and assignment deadlines: parts of sentences that mention an event word and a date.
 * Options: `ref` (when it was said), `subject` (added to titles), `locale` (how to read 10/11).
 * Returns [{ date, type: "test"|"assignment", title, sentence }].
 */
export function findEvents(text, { ref = new Date(), subject = null, locale } = {}) {
  const opts = { locale };
  const events = [];
  const seen = new Set();
  let lastHit = null;
  let carried = null; // the event of the sentence before, for "It was gonna be on the 10th, now it's the 17th"
  for (const sentence of withCorrections(sentences(text))) {
    const before = carried;
    carried = null;
    // Dates are found in the whole sentence, so one said relative to another ("a week later") still counts.
    const all = findDates(sentence, ref, opts);
    const parts = all.length > 1 ? splitDeadlines(sentence, all) : [{ text: sentence, start: 0 }];
    for (const { text: part, start } of parts) {
      let hit = eventWord(part, /^(?:es|pt)/i.test(locale || ""));
      // "el examen práctico es el 26/11, y el teórico el 30/11": the second part borrows the event
      const ell = !hit && parts.length > 1 && lastHit && part.match(/^(?:and|y|e)\s+(?:the|el|la|o|a)\s+([\p{L}]+)/iu);
      if (ell) hit = { ...lastHit, index: ell[0].length - ell[1].length, text: ell[1] };
      let title = null;
      if (!hit && before && /^(?:it|it's|that|that's|this|now it's|now it|so it's)(?![\p{L}])/iu.test(part))
        ({ hit, title } = { hit: { ...before.hit, index: 0 }, title: before.title });
      if (!hit) continue;
      lastHit = hit;
      title ||= titleFor(part, hit, subject);
      carried = { hit, title };
      // "you didn't know when the mid-term was": talk about knowing a date, not the date itself
      if (
        /\b(?:know|knew|knows|remember|forget|forgot|ask(?:ed)?|wonder(?:ed)?|not sure|unsure)\s+when\b/i.test(part) &&
        !DUE_CUE.test(part)
      )
        continue;
      // "the labs are on Monday and Tuesday afternoon": a weekly schedule, not events
      if (/^labs?$/.test(hit.word) && /\blabs\s+(?:are|run|meet|happen)\b/i.test(part)) continue;
      const own = clauseAt(part, hit.index);
      if (GRADES.test(own) || (NOT_DUE.test(own) && !DUE_CUE.test(part))) continue;
      const dates = all
        .filter((d) => d.index >= start && d.end <= start + part.length)
        .map((d) => ({ ...d, index: d.index - start, end: d.end - start }))
        // "that will cover everything you've learned up through next Wednesday": where the material stops, not an event
        .filter(
          (d) =>
            !(
              /\bup (?:through|to|until)\s*$/i.test(part.slice(Math.max(0, d.index - 16), d.index)) &&
              /\b(?:cover|covers|covered|learned|taught|material|everything)\b/i.test(part)
            ),
        );
      if (!dates.length) continue;
      // Cancelled, unless it was moved to a date said after the move ("cancelled Friday, moved to Monday")
      const moved = part.match(RESCHEDULE);
      if (CANCELLED.test(clauseAt(part, hit.index)) && !(moved && dates.some((d) => d.index > moved.index))) continue;
      for (const d of pickDates(part, dates, hit)) {
        const key = `${d.date}|${title.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push({ date: d.date, type: hit.type, title, sentence });
      }
    }
  }
  return events;
}
