// Makes an animated SVG: a cat walks over your GitHub contribution graph.
// Run in GitHub Actions (see .github/workflows/cat.yml) or locally with: node generate-cat.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const user = process.env.GITHUB_USER || process.env.GITHUB_REPOSITORY_OWNER;
const token = process.env.GITHUB_TOKEN;

// ---------- 1. get contribution days (grouped by week) ----------
async function getWeeks() {
    if (!user || !token) return fakeWeeks();   // no token: random preview data
    const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{contributionCount weekday}}}}}}`;
    const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { login: user } })
    });
    const json = await res.json();
    if (!json.data) throw new Error(JSON.stringify(json));
    return json.data.user.contributionsCollection.contributionCalendar.weeks.map((w) => w.contributionDays);
}

function fakeWeeks() {
    return Array.from({ length: 53 }, () =>
        Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            contributionCount: Math.random() < 0.45 ? 0 : Math.floor(Math.random() * 12)
        })));
}

// ---------- 2. layout ----------
const SIZE = 12, STEP = 15, PAD = 20;
const weeks = await getWeeks();
const max = Math.max(1, ...weeks.flat().map((d) => d.contributionCount));
const level = (c) => (c === 0 ? 0 : Math.ceil((c / max) * 4));

// cat walks down column 1, up column 2, and so on
const cells = [];
weeks.forEach((days, w) => {
    const col = [...days].sort((a, b) => a.weekday - b.weekday);
    if (w % 2) col.reverse();
    col.forEach((d) => cells.push({ x: PAD + w * STEP, y: PAD + d.weekday * STEP, level: level(d.contributionCount) }));
});

const N = cells.length;
const T = Math.max(10, N * 0.05);                 // seconds for one walk
const width = PAD * 2 + weeks.length * STEP - (STEP - SIZE);
const height = PAD * 2 + 7 * STEP - (STEP - SIZE);
const center = (c) => `${c.x + SIZE / 2} ${c.y + SIZE / 2}`;
const path = "M" + cells.map(center).join(" L");

// ---------- 3. draw ----------
const squares = cells.map((c, i) => {
    const f = (0.9 * i) / (N - 1);                // when the cat reaches this day
    const dim = c.level
        ? `<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" keyTimes="0;${f.toFixed(4)};${(f + 0.004).toFixed(4)};0.97;1" values="1;1;0.15;0.15;1"/>`
        : "";
    return `<rect class="l${c.level}" x="${c.x}" y="${c.y}" width="${SIZE}" height="${SIZE}" rx="2">${dim}</rect>`;
}).join("\n");

const cat = `
<g>
  <animateMotion dur="${T}s" repeatCount="indefinite" path="${path}" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.9;1"/>
  <g transform="translate(-15,-13) scale(0.25)">
    <polygon points="22,34 28,4 52,24" fill="#e9b44c"/>
    <polygon points="98,34 92,4 68,24" fill="#e9b44c"/>
    <polygon points="29,28 31,14 42,24" fill="#e07a5f"/>
    <polygon points="91,28 89,14 78,24" fill="#e07a5f"/>
    <path d="M12 64 C12 30 34 18 60 18 C86 18 108 30 108 64 Z" fill="#e9b44c"/>
    <path d="M54 20 V28 M60 19 V29 M66 20 V28" stroke="#e07a5f" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="42" cy="44" rx="4.5" ry="5.5" fill="#222"/>
    <ellipse cx="78" cy="44" rx="4.5" ry="5.5" fill="#222"/>
    <circle cx="43.5" cy="42" r="1.6" fill="#fff"/>
    <circle cx="79.5" cy="42" r="1.6" fill="#fff"/>
    <circle cx="31" cy="54" r="5" fill="#e07a5f" opacity=".5"/>
    <circle cx="89" cy="54" r="5" fill="#e07a5f" opacity=".5"/>
    <path d="M56 50 H64 L60 55 Z" fill="#e07a5f"/>
    <path d="M60 55 Q56 60 52 57 M60 55 Q64 60 68 57" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M20 50 L3 46 M20 55 L3 57 M100 50 L117 46 M100 55 L117 57" stroke="#999" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="36" cy="62" rx="10" ry="6" fill="#fff" stroke="#e9b44c" stroke-width="2"/>
    <ellipse cx="84" cy="62" rx="10" ry="6" fill="#fff" stroke="#e9b44c" stroke-width="2"/>
  </g>
</g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<style>
  /* square colors: change them here */
  .l0{fill:#ebedf0}.l1{fill:#9be9a8}.l2{fill:#40c463}.l3{fill:#30a14e}.l4{fill:#216e39}
  @media (prefers-color-scheme: dark){
    .l0{fill:#161b22}.l1{fill:#0e4429}.l2{fill:#006d32}.l3{fill:#26a641}.l4{fill:#39d353}
  }
</style>
${squares}
${cat}
</svg>`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/cat.svg", svg);
console.log(`dist/cat.svg written (${N} days${user ? " for " + user : ", preview data"})`);
