export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Handle body parsing manually in case Vercel doesn't parse it
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);

    const { apiKey, databaseId } = body || {};

    if (!apiKey || !databaseId) {
      return res.status(400).json({ error: "Missing apiKey or databaseId" });
    }

    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_size: 100 }),
      }
    );

    const data = await notionRes.json();
    if (!notionRes.ok) return res.status(notionRes.status).json({ error: data.message || "Notion API error" });
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
