// ===============================
// Helpers
// ===============================
const $ = (id) => document.getElementById(id);

function clampInt(n, min, max, fallback) {
  const x = Number.parseInt(n, 10);
  if (Number.isNaN(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function fmtCHF(amount) {
  const rounded = Math.round(amount);
  return `CHF ${rounded.toLocaleString("de-CH")}.-`;
}

function todayCH() {
  const d = new Date();
  return d.toLocaleDateString("de-CH", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function computeMobileAnnual(pensumPct) {
  // Art.12: CHF 250 / year proportional to pensum
  return 250 * (pensumPct / 100);
}

function computeMobilityAnnual() {
  return 150;
}

function computeTotals({ pensumPct, includeMobile, includeMobility }) {
  let total = 0;
  const parts = [];

  if (includeMobile) {
    const mobile = computeMobileAnnual(pensumPct);
    total += mobile;
    parts.push({ label: "Mobiltelefonpauschale (jährlich)", amount: mobile });
  }

  if (includeMobility) {
    const mobility = computeMobilityAnnual();
    total += mobility;
    parts.push({ label: "Mobilitätspauschale (jährlich)", amount: mobility });
  }

  return { total, parts };
}

function setStatus(id, msg, ms = 0) {
  $(id).textContent = msg;
  if (ms > 0) setTimeout(() => ($(id).textContent = ""), ms);
}

// ===============================
// Generator (exact layout requested)
// ===============================
function generateEmailText() {
  const fullName = $("fullName").value.trim() || "[Vorname Nachname]";
  const role = $("role").value.trim() || "[Funktion]";
  const pensumPct = clampInt($("pensum").value, 1, 100, 100);

  const includeMobile = $("chkMobile").checked;
  const includeMobility = $("chkMobility").checked;

  const { total, parts } = computeTotals({ pensumPct, includeMobile, includeMobility });

  const partsLines = parts.length
    ? parts.map(p => `- ${p.label}: ${fmtCHF(p.amount)}`).join("\n")
    : "- (keine Pauschalen ausgewählt)";

  // Exact header block (no email address in body)
  const headerBlock =
`Schulverwaltung
Stefan Bättig
Eintrachtstrasse 24
8820 Wädenswil`;

  const body =
`${headerBlock}

Datum: ${todayCH()}

Betreff: Antrag auf pauschale Spesenentschädigungen

Lieber Stefan

Hiermit beantrage ich die Ausrichtung der pauschalen Spesenentschädigungen gemäss den geltenden Regelungen. Meine Angaben:

Name: ${fullName}
Funktion: ${role}
Anstellungsgrad: vgl. Pensenvereinbarung

Beantragte Pauschalen:
${partsLines}

Total (jährlich): ${fmtCHF(total)}

Ich bitte um Bestätigung der Auszahlung (inkl. Stichtag/Abrechnungsmodus) sowie um kurze Rückmeldung, falls ergänzende Angaben benötigt werden.

Freundliche Grüsse
`;

  $("emailText").value = body;
}

// ===============================
// Clipboard
// ===============================
async function copyToClipboard() {
  const text = $("emailText").value;
  if (!text.trim()) {
    setStatus("copyStatus", "Nichts zu kopieren.", 1500);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("copyStatus", "Kopiert ✓", 1200);
  } catch {
    try {
      $("emailText").focus();
      $("emailText").select();
      const ok = document.execCommand("copy");
      setStatus("copyStatus", ok ? "Kopiert ✓" : "Kopieren fehlgeschlagen.", 1500);
    } catch {
      setStatus("copyStatus", "Kopieren fehlgeschlagen (Browserrechte).", 1800);
    }
  }
}

// ===============================
// Outlook / Mailto
// ===============================
function openOutlookMail() {
  const to = "stefan.baettig@pswaedenswil";
  const subject = "Antrag auf pauschale Spesenentschädigungen";
  const body = $("emailText").value.trim();

  if (!body) {
    setStatus("outlookStatus", "Bitte zuerst „Text generieren“.", 1800);
    return;
  }

  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  setStatus("outlookStatus", "Mailfenster wird geöffnet…", 1500);
}

// ===============================
// Dictation (Web Speech API)
// ===============================
let recognition = null;
let isDictating = false;

function initDictation() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("dictStatus", "Diktieren nicht verfügbar (Browser).");
    $("btnDictate").disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "de-CH";
  recognition.interimResults = true;
  recognition.continuous = true;

  let finalChunk = "";

  recognition.onstart = () => {
    isDictating = true;
    $("btnDictate").disabled = true;
    $("btnStopDictate").disabled = false;
    setStatus("dictStatus", "Diktieren läuft…");
  };

  recognition.onerror = (e) => {
    setStatus("dictStatus", `Diktierfehler: ${e.error}`);
  };

  recognition.onend = () => {
    isDictating = false;
    $("btnDictate").disabled = false;
    $("btnStopDictate").disabled = true;
    setStatus("dictStatus", "");
    finalChunk = "";
  };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalChunk += transcript;
      else interim += transcript;
    }
    if (interim.trim()) setStatus("dictStatus", `…${interim.trim()}`);
    if (finalChunk.trim()) {
      insertAtCursor($("emailText"), finalChunk);
      finalChunk = "";
      setStatus("dictStatus", "✓ eingefügt");
      setTimeout(() => { if (isDictating) setStatus("dictStatus", "Diktieren läuft…"); }, 600);
    }
  };
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);

  const needsSpace = before && !before.endsWith("\n") && !before.endsWith(" ") ? " " : "";
  const insertText = needsSpace + text.trim() + " ";

  textarea.value = before + insertText + after;
  const newPos = (before + insertText).length;
  textarea.focus();
  textarea.setSelectionRange(newPos, newPos);
}

function startDictation() {
  if (!recognition) return;
  try { recognition.start(); } catch {}
}

function stopDictation() {
  if (!recognition) return;
  recognition.stop();
}

// ===============================
// Wiring
// ===============================
function resetFields() {
  ["fullName","role","pensum"].forEach(id => $(id).value = "");
  $("chkMobile").checked = true;
  $("chkMobility").checked = true;
  $("emailText").value = "";
  setStatus("copyStatus", "");
  setStatus("outlookStatus", "");
  setStatus("dictStatus", "");
}

document.addEventListener("DOMContentLoaded", () => {
  $("btnGenerate").addEventListener("click", generateEmailText);
  $("btnCopy").addEventListener("click", copyToClipboard);
  $("btnOutlook").addEventListener("click", openOutlookMail);
  $("btnReset").addEventListener("click", resetFields);

  initDictation();
  $("btnDictate").addEventListener("click", startDictation);
  $("btnStopDictate").addEventListener("click", stopDictation);

  $("pensum").addEventListener("keydown", (e) => {
    if (e.key === "Enter") generateEmailText();
  });
});
