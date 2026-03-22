const fetch = require("node-fetch");

const HF_BASE = "https://router.huggingface.co/hf-inference/models";

async function callHF(model, inputs) {
  const response = await fetch(`${HF_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json",
      "x-wait-for-model": "true",
    },
    body: JSON.stringify({ inputs }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${response.status}: ${err}`);
  }

  const data = await response.json();
  return data[0]?.translation_text || "";
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, src_lang, tgt_lang } = req.body;

  if (!text || !src_lang || !tgt_lang)
    return res.status(400).json({ error: "Missing required fields." });

  if (src_lang === tgt_lang)
    return res.json({ translated: text });

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
        const eng = await callHF("Helsinki-NLP/opus-mt-hi-en", text);
        translated = await callHF("Helsinki-NLP/opus-mt-en-mul", `>>kan<< ${eng}`);
        break;
      }
      case "kan_Knda->hin_Deva": {
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
};
