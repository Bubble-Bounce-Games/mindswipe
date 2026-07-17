require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Notion sync endpoint
app.post("/api/notion", async (req, res) => {
  try {
    // Use env variables if not provided in body (extra security)
    const apiKey = req.body.apiKey || process.env.NOTION_API_KEY;
    const databaseId = req.body.databaseId || process.env.NOTION_DATABASE_ID;

    if (!apiKey || !databaseId) {
      return res.status(400).json({ error: "Missing API key or Database ID" });
    }

    let allResults = [];
    let hasMore = true;
    let cursor = undefined;

    // Paginate through ALL pages (Notion returns max 100 at a time)
    while (hasMore) {
      const body = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;

      const notionRes = await fetch(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await notionRes.json();

      if (!notionRes.ok) {
        return res.status(notionRes.status).json({
          error: data.message || "Notion API error",
          code: data.code,
        });
      }

      allResults = [...allResults, ...data.results];
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    // Parse Notion pages into clean knowledge cards
    const cards = allResults.map(page => parseNotionPage(page)).filter(Boolean);

    return res.status(200).json({ cards, total: cards.length });

  } catch (err) {
    console.error("Notion sync error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Parse a Notion page into a clean card object
function parseNotionPage(page) {
  try {
    const props = page.properties;

    // Title — works with any property named Title/Name/title/name
    const titleProp = Object.values(props).find(p => p.type === "title");
    const title = titleProp?.title?.map(t => t.plain_text).join("").trim() || "Untitled";

    // Content — grab all rich_text fields and join them
    const contentParts = Object.entries(props)
      .filter(([key, p]) => p.type === "rich_text" && p.rich_text?.length > 0)
      .map(([key, p]) => p.rich_text.map(t => t.plain_text).join("").trim())
      .filter(Boolean);
    const content = contentParts.join("\n\n") || "(No content — open Notion for details)";

    // Type — looks for a Select property
    const selectProp = Object.values(props).find(p => p.type === "select" && p.select);
    const VALID_TYPES = ["book", "article", "quote", "idea", "note"];
    const rawType = selectProp?.select?.name?.toLowerCase();
    const type = VALID_TYPES.includes(rawType) ? rawType : "note";

    // Tags — looks for a Multi-select property
    const multiProp = Object.values(props).find(p => p.type === "multi_select");
    const tags = multiProp?.multi_select?.map(t => t.name.toLowerCase()) || [];

    // URL — looks for a URL property
    const urlProp = Object.values(props).find(p => p.type === "url" && p.url);
    const url = urlProp?.url || null;

    // Date — created time or a Date property
    const dateProp = Object.values(props).find(p => p.type === "date" && p.date);
    const date = dateProp?.date?.start || page.created_time || null;

    return {
      notionId: page.id,
      title,
      content,
      type,
      tags,
      url,
      date,
      notionUrl: page.url,
    };
  } catch (err) {
    console.error("Failed to parse page:", page.id, err);
    return null;
  }
}

app.listen(PORT, () => {
  console.log(`✅ MindSwipe running at http://localhost:${PORT}`);
  console.log(`📡 Notion proxy at http://localhost:${PORT}/api/notion`);
});
