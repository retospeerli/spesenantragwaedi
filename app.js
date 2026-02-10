// =====================================================
// Spesen-Textgenerator (PSW) – Full app.js
// Features:
// - first/last name separate; signature uses first name only
// - tone selector (happy/neutral/grumpy)
// - live summary (mobile + mobility + total)
// - copy-to-clipboard with feedback
// - mailto "Outlook" button
// - dictation (Web Speech API, de-CH)
// =====================================================

const $ = (id) => document.getElementById(id);

let currentTone = "neutral";

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
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function setStatus(id, msg, cls = "", ms = 0) {
  const el = $(id);
  if (!el) return;
  el.className = `status ${cls}`.trim();
  el.textContent = msg;
  if (ms > 0) setTimeout(() => { el.textContent = ""; el.className = "status"; }, ms);
}

// ===============================
// Calculations
// ===============================
function computeMobileAnnual(pensumPct) {
  return 250 * (pensumPct / 100);
}
function computeMobilityAnnual() {
  return 150;
}
function computeTotals({ pensumPct, includeMobile, includeMobility }) {
  let total = 0;
  const parts = [];
  let mobile = 0;
  let mobility = 0;

  if (includeMobile) {
    mobile = computeMobileAnnual(pensumPct);
    total += mobile;
    parts.push({ label: "Mobiltelefonpauschale (jährlich)", amount: mobile });
  }
  if (includeMobility) {
    mobility = computeMobilityAnnual();
    total += mobility;
    parts.push({ label: "Mobilitätspauschale (jährlich)", amount: mobility });
  }
  return { total, parts, mobile, mobility };
}

// ===============================
// Tone text blocks
// ===============================
function toneLabel(tone) {
  if (tone === "happy") return "Wertschätzend";
  if (tone === "grumpy") return "Mühsam, aber höflich";
  return "Sachlich";
}

function toneIntro() {
  if (currentTone === "happy") {
    return "Besten Dank vorab für die Unterstützung und die stets konstruktive Zusammenarbeit.";
  }
  if (currentTone === "grumpy") {
    return "Auch wenn das Verfahren unnötig aufwändig wirkt, reiche ich den Antrag hiermit formell ein.";
  }
  return "Hiermit beantrage ich die Ausrichtung der pauschalen Spesenentschädigungen gemäss den geltenden Regelungen.";
}

function toneClosing() {
  if (currentTone === "happy") {
    return "Herzlichen Dank für die Bearbeitung und eine kurze Bestätigung der Auszahlung.";
  }
  if (currentTone === "grumpy") {
    return "Ich danke dir für die Prüfung und bitte um eine kurze Bestätigung der Auszahlung.";
  }
  return "Ich danke dir für die Bearbeitung und bitte um eine kurze Bestätigung der Auszahlung.";
}

// ===============================
// Live summary
// ===============================
function updateSummary() {
  const pensumPct = clampInt($("pensum").value, 1, 100, 100);
  const includeMobile = $("chkMobile").checked;
  const includeMobility = $("chkMobility").checked;

  const { total, mobile, mobility } = computeTotals({ pensumPct, includeMobile, includeMobility });

  $("sumMobile").textContent = includeMobile ? fmtCHF(mobile) : "—";
  $("sumMobility").textContent = includeMobility ? fmtCHF(mobility) : "—";
  $("sumTotal").textContent = (includeMobile || includeMobility) ? fmtCHF(total) : "—";
}

// ===============================
// Email generation (fixed layout)
// ===============================
function generateEmailText() {
  const firstName = $("firstName").value.trim() || "[Vorname]";
  const lastName = $("lastName").value.trim() || "[Nachname]";
  const role = $("role").value.trim() || "[Funktion]";
  const pensumPct = clampInt($("pensum").value, 1, 100, 100);

  const includeMobile = $("chkMobile").checked;
  const includeMobility = $("chkMobility").checked;

  const { total, parts } = computeTotals({ pensumPct, includeMobile, includeMobility });

  const partsLines = parts.length
    ? parts.map(p => `- ${p.label}: ${fmtCHF(p.amount)}`).join("\n")
    : "- (keine Pauschalen ausgewählt)";

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

${toneIntro()}

Meine Angaben:

Name: ${firstName} ${lastName}
Funktion: ${role}
Anstellungsgrad: vgl. Pensenvereinbarung

Beantragte Pauschalen:
${partsLines}

Total (jährlich): ${fmtCHF(total)}

Ich bitte um Bestätigung der Auszahlung (inkl. Stichtag/Abrechnungsmodus) sowie um kurze Rückmeldung, falls ergänzende Angaben benötigt werden.

${toneClosing()}

Freundliche Grüsse

${firstName}
`;

  $("emailText").value = body;
  setStatus("copyStatus", "Text aktualisiert.", "ok", 1200);
}

// ===============================
// Clipboard
// ===============================
async function copyToClipboard() {
  const text = $("emailText").value.trim();
  if (!text) {
    setStatus("copyStatus", "Bitte zuerst Text generieren.", "warn", 1600);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("copyStatus", "Kopiert ✓", "ok", 1200);
  } catch {
    try {
      $("emailText").focus();
      $("emailText").select();
      const ok = document.execCommand("copy");
      setStatus("copyStatus", ok ? "Kopiert ✓" : "Kopieren fehlgeschlagen.", ok ? "ok" : "warn", 1500);
    } catch {
      setStatus("copyStatus", "Kopieren fehlgeschlagen (Browserrechte).", "warn", 1800);
    }
  }
}

// ===============================
// Outlook (mailto)
// ===============================
function openOutlookMail() {
  const to = "stefan.baettig@pswaedenswil";
  const subject = "Antrag auf pauschale Spesenentschädigungen";
  const body = $("emailText").value.trim();

  if (!body) {
    setStatus("outlookStatus", "Bitte zuerst Text generieren.", "warn", 1800);
    return;
  }

  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  setStatus("outlookStatus", "Mailfenster wird geöffnet…", "ok", 1500);
}

// ===============================
// Dictation (Web Speech API)
// ===============================
let recognition = null;

function initDictation() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("dictStatus", "Diktieren nicht verfügbar (Browser).", "warn");
    $("btnDictate").disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "de-CH";
  recognition.interimResults = true;
  recognition.continuous = true;

  let finalChunk = "";

  recognition.onstart = () => {
    $("btnDictate").disabled = true;
    $("btnStopDictate").disabled = false;
    setStatus("dictStatus", "Diktieren läuft…");
  };

  recognition.onerror = (e) => {
    setStatus("dictStatus", `Diktierfehler: ${e.error}`, "warn");
  };

  recognition.onend = () => {
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
      setStatus("dictStatus", "✓ eingefügt", "ok", 700);
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
// Reset
// ===============================
function resetFields() {
  ["firstName","lastName","role","pensum"].forEach(id => $(id).value = "");
  $("chkMobile").checked = true;
  $("chkMobility").checked = true;

  // tone back to neutral
  currentTone = "neutral";
  document.querySelectorAll(".toneBtn").forEach(b => b.classList.remove("active"));
  const neutralBtn = document.querySelector('.toneBtn[data-tone="neutral"]');
  if (neutralBtn) neutralBtn.classList.add("active");
  $("toneLabel").textContent = toneLabel("neutral");

  $("emailText").value = "";
  setStatus("copyStatus", "");
  setStatus("outlookStatus", "");
  setStatus("dictStatus", "");
  updateSummary();
}

// ===============================
// Wiring
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  // tone buttons
  document.querySelectorAll(".toneBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentTone = btn.dataset.tone;

      document.querySelectorAll(".toneBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $("toneLabel").textContent = toneLabel(currentTone);

      // update text immediately if exists or inputs present
      generateEmailText();
    });
  });

  // buttons
  $("btnGenerate").addEventListener("click", generateEmailText);
  $("btnCopy").addEventListener("click", copyToClipboard);
  $("btnOutlook").addEventListener("click", openOutlookMail);
  $("btnReset").addEventListener("click", resetFields);

  // live summary updates
  ["pensum","chkMobile","chkMobility"].forEach(id => {
    $(id).addEventListener("input", updateSummary);
    $(id).addEventListener("change", updateSummary);
  });
  updateSummary();

  // dictation
  initDictation();
  $("btnDictate").addEventListener("click", startDictation);
  $("btnStopDictate").addEventListener("click", stopDictation);

  // convenience: Enter in pensum triggers generation
  $("pensum").addEventListener("keydown", (e) => {
    if (e.key === "Enter") generateEmailText();
  });
});
