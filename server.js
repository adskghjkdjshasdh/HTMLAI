import express from "express";
import cors from "cors";
import katex from "katex";
import emoji from "node-emoji";

const apiKey = process.env.COHERE_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());

// Process text: KaTeX + emojis
function processText(text) {
  text = emoji.emojify(text);

  // Block math $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr, { displayMode: true, throwOnError: false });
    } catch {
      return expr;
    }
  });

  // Inline math $...$
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
        <h1>AI Backend Online!</h1>
        <p>POST to <code>/</code> with JSON: { "prompt": "..." }</p>
      </body>
    </html>
  `);
});

// Chat endpoint
app.post("/", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).send("Missing 'prompt'");

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

    // FIX: Extract first text from any message/content
    let text = "";
    if (data.messages?.length > 0) {
      for (const msg of data.messages) {
        if (msg.content?.length > 0) {
          for (const block of msg.content) {
            if (block.text) {
              text = block.text;
              break;
            } else if (block.type === "output_text" && block.text) {
              text = block.text;
              break;
            }
          }
        }
        if (text) break; // Stop at first text found
      }
    }

    if (!text) {
      throw new Error("Cohere returned no text in the response");
    }

    // Process KaTeX + emojis
    text = processText(text);

    // Return HTML
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
    res.status(500).send(`Error: ${err.message}`);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
