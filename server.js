import express from "express";
import cors from "cors";
import katex from "katex";
import emoji from "node-emoji";

const apiKey = process.env.COHERE_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());

// Function to process text: render LaTeX and emojis
function processText(text) {
  // Convert emoji shortcodes
  text = emoji.emojify(text);

  // Render block math $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr, { displayMode: true, throwOnError: false });
    } catch {
      return expr;
    }
  });

  // Render inline math $...$
  text = text.replace(/\$([^$]+)\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr, { displayMode: false, throwOnError: false });
    } catch {
      return expr;
    }
  });

  return text;
}

// Homepage
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css">
        <title>AI Backend</title>
      </head>
      <body>
        <h1>AI is online!</h1>
        <p>POST to <code>/</code> with { "prompt": "..." }</p>
      </body>
    </html>
  `);
});

// Chat endpoint
app.post("/", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing 'prompt'" });

    const response = await fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-a-03-2025",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cohere API error: ${response.status} ${errText}`);
    }

    const data = await response.json();

    // ✅ Correct path to Cohere assistant text
    let text = data.messages[0].content[0].text;

    // ✅ Process KaTeX + emojis
    text = processText(text);

    // Return as HTML so math renders
    res.send(`
      <html>
        <head>
          <meta charset="UTF-8">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css">
        </head>
        <body>
          <div>${text}</div>
        </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
