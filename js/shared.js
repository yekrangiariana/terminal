/* ════════════════════════════════════════════════════════════════
   shared.js  —  loaded by BOTH index.html and desktop.html
   Contains: content registry, frontmatter parser, date sort.
   ════════════════════════════════════════════════════════════════

   To add new content:
     1. Create blog/<slug>.md with standard frontmatter (including category)
     2. Add "<slug>" to SLUGS below
   ════════════════════════════════════════════════════════════════ */

// ── Content registry ────────────────────────────────────────────────────────
const SLUGS = [
  "why-the-internet-feels-smaller",
  "notes-on-silence",
  "building-this-terminal",
  "data-journalism-eu-elections",
  "tracking-disinformation-networks",
  "climate-data-scraper",
  "parliament-tracker",
  "news-graph",
  "this-site",
];

// ── Frontmatter parser ─────────────────────────────────────────────────────────
// Returns { meta: { slug, title, date, category, tags[], url, description, image },
//           body: string }
function parseFrontmatter(md) {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const meta = {};
  let body = md;
  if (match) {
    match[1].split("\n").forEach((line) => {
      const sep = line.indexOf(":");
      if (sep === -1) return;
      const k = line.slice(0, sep).trim();
      const v = line.slice(sep + 1).trim();
      meta[k] =
        k === "tags"
          ? v
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : v;
    });
    body = md.slice(match[0].length).trim();
  }
  return { meta, body };
}

// ── Sort array of posts newest-first by .date string ─────────────────────────
function byDate(arr) {
  return [...arr].sort((a, b) =>
    b.date > a.date ? 1 : b.date < a.date ? -1 : 0,
  );
}
