// Works both locally and on Vercel
const BACKEND_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000/translate"
  : "/translate";
const MAX_HISTORY = 5;

// Language display names keyed by code
const LANG_NAMES = {
  eng_Latn: "English",
  hin_Deva: "Hindi",
  kan_Knda: "Kannada",
};

// DOM refs
const inputText   = document.getElementById("input-text");
const outputText  = document.getElementById("output-text");
const srcLang     = document.getElementById("src-lang");
const tgtLang     = document.getElementById("tgt-lang");
const translateBtn = document.getElementById("translate-btn");
const btnLabel    = document.getElementById("btn-label");
const spinner     = document.getElementById("spinner");
const errorMsg    = document.getElementById("error-msg");
const copyBtn     = document.getElementById("copy-btn");
const swapBtn     = document.getElementById("swap-btn");
const charCount   = document.getElementById("char-count");
const historyList = document.getElementById("history-list");

// Load history from localStorage
let history = JSON.parse(localStorage.getItem("translationHistory") || "[]");
renderHistory();

// --- Character counter ---
inputText.addEventListener("input", () => {
  charCount.textContent = `${inputText.value.length} / 500`;
});

// --- Swap languages ---
swapBtn.addEventListener("click", () => {
  const tmp = srcLang.value;
  srcLang.value = tgtLang.value;
  tgtLang.value = tmp;

  // Also swap text content if there's a translation
  const currentOutput = outputText.dataset.value || "";
  if (currentOutput) {
    inputText.value = currentOutput;
    outputText.innerHTML = '<span class="output-placeholder">Translation will appear here...</span>';
    outputText.classList.remove("has-content");
    delete outputText.dataset.value;
    charCount.textContent = `${inputText.value.length} / 500`;
  }
});

// --- Copy to clipboard ---
copyBtn.addEventListener("click", async () => {
  const text = outputText.dataset.value || outputText.textContent;
  if (!text || text === "Translation will appear here...") return;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  } catch {
    copyBtn.textContent = "Failed";
  }
});

// --- Translate ---
translateBtn.addEventListener("click", translate);

// Allow Ctrl+Enter to trigger translation
inputText.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") translate();
});

async function translate() {
  const text = inputText.value.trim();
  if (!text) {
    showError("Please enter some text to translate.");
    return;
  }

  if (srcLang.value === tgtLang.value) {
    showError("Source and target languages must be different.");
    return;
  }

  setLoading(true);
  hideError();

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        src_lang: srcLang.value,
        tgt_lang: tgtLang.value,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Translation failed. Please try again.");
      return;
    }

    outputText.textContent = data.translated;
    outputText.classList.add("has-content");
    outputText.dataset.value = data.translated;
    saveHistory(text, data.translated, srcLang.value, tgtLang.value);
  } catch (err) {
    showError("Could not reach the server. Make sure the backend is running.");
  } finally {
    setLoading(false);
  }
}

// --- Helpers ---
function setLoading(on) {
  translateBtn.disabled = on;
  btnLabel.textContent = on ? "Translating..." : "Translate";
  spinner.classList.toggle("hidden", !on);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}

function hideError() {
  errorMsg.classList.add("hidden");
}

function saveHistory(input, output, src, tgt) {
  history.unshift({ input, output, src, tgt });
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  localStorage.setItem("translationHistory", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";

  if (history.length === 0) {
    historyList.innerHTML = '<li style="color:#718096;font-size:0.85rem;">No translations yet.</li>';
    return;
  }

  history.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="hist-langs">${LANG_NAMES[item.src] || item.src} → ${LANG_NAMES[item.tgt] || item.tgt}</div>
      <div class="hist-text">
        <span>${item.input}</span>
        <span class="hist-arrow">→</span>
        <span>${item.output}</span>
      </div>
    `;
    // Click to restore
    li.addEventListener("click", () => {
      inputText.value = item.input;
      outputText.textContent = item.output;
      outputText.classList.add("has-content");
      outputText.dataset.value = item.output;
      srcLang.value = item.src;
      tgtLang.value = item.tgt;
      charCount.textContent = `${item.input.length} / 500`;
    });
    historyList.appendChild(li);
  });
}
