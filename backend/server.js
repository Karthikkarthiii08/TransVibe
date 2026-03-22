require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const HF_BASE = "https://router.huggingface.co/hf-inference/models";

// Generic HF inference call
async function callHF(model, inputs, parameters = {}) {
  const body = Object.keys(parameters).length
    ? { inputs, parameters }
    : { inputs };

  const response = await fetch(`${HF_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json",
      "x-wait-for-model": "true",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[${model}] error ${response.status}:`, err);
    throw new Error(`${response.status}`);
  }

  const data = await response.json();
  console.log(`[${model}] =>`, JSON.stringify(data));
  return data[0]?.translation_text || "";
}

// POST /translate — all 6 pairs: eng<->hin, eng<->kan, hin<->kan
app.post("/translate", async (req, res) => {
  const { text, src_lang, tgt_lang } = req.body;

  if (!text || !src_lang || !tgt_lang) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (src_lang === tgt_lang) {
    return res.json({ translated: text });
  }

  const pair = `${src_lang}->${tgt_lang}`;

  try {
    let translated;

    switch (pair) {
      case "eng_Latn->hin_Deva":
        translated = await callHF("Helsinki-NLP/opus-mt-en-hi", text);
        break;

      case "hin_Deva->eng_Latn":
        translated = await callHF("Helsinki-NLP/opus-mt-hi-en", text);
        break;

      case "eng_Latn->kan_Knda":
        translated = await callHF("Helsinki-NLP/opus-mt-en-mul", `>>kan<< ${text}`);
        break;

      case "kan_Knda->eng_Latn":
        translated = await callHF("Helsinki-NLP/opus-mt-mul-en", text);
        break;

      case "hin_Deva->kan_Knda": {
        // Pivot: Hindi -> English -> Kannada (use mul-en for reliable Hindi->English)
        const eng = await callHF("Helsinki-NLP/opus-mt-mul-en", text);
        translated = await callHF("Helsinki-NLP/opus-mt-en-mul", `>>kan<< ${eng}`);
        break;
      }

      case "kan_Knda->hin_Deva": {
        // Pivot: Kannada -> English -> Hindi
        const eng = await callHF("Helsinki-NLP/opus-mt-mul-en", text);
        translated = await callHF("Helsinki-NLP/opus-mt-en-hi", eng);
        break;
      }

      default:
        return res.status(400).json({ error: "Unsupported language pair." });
    }

    res.json({ translated });
  } catch (err) {
    console.error("Translation error:", err.message);
    res.status(500).json({ error: "Translation failed. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Translator backend running on http://localhost:${PORT}`);
});
