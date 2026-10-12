// Appendix C of the build spec, with the visual spec 11.1 revisions.
// Fails when product code references a Salt token the IMPORTED theme does not define, when an app
// token is undefined, or when product CSS breaks SALT-17 / SALT-25 (as revised).
// Usage: node scripts/verify-tokens.mjs [--allow-fallbacks]
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";

// Only the theme files src/main.tsx imports count: a token that exists only in the legacy theme
// would resolve to nothing at run time (decision D3 in SPEC-COMPLIANCE.md).
const THEME_FILES = ["node_modules/@salt-ds/theme/css/global.css", "node_modules/@salt-ds/theme/css/theme-next.css"];
const SRC_DIR = "src";
const APP_TOKENS = "src/styles/palette.css";
const allowFallbacks = process.argv.includes("--allow-fallbacks");

for (const f of THEME_FILES) {
  if (!existsSync(f)) { console.error(`Missing ${f}. Run npm install first.`); process.exit(1); }
}

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".vite") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.includes(extname(p))) out.push(p);
  }
  return out;
}

// 1. Tokens the imported theme defines. palette.css may also define (override) existing Salt tokens.
const defined = new Set();
for (const f of THEME_FILES) {
  for (const m of readFileSync(f, "utf8").matchAll(/(--salt-[A-Za-z0-9-]+)\s*:/g)) defined.add(m[1]);
}

// 2. App tokens defined in palette.css.
const appDefined = new Set();
const paletteCss = existsSync(APP_TOKENS) ? readFileSync(APP_TOKENS, "utf8") : "";
for (const m of paletteCss.matchAll(/(--pc-[A-Za-z0-9-]+)\s*:/g)) appDefined.add(m[1]);

const errors = [];
const fallbackWarnings = [];
const files = walk(SRC_DIR, [".css", ".tsx", ".ts"]);

// Overriding a Salt token that does not exist is the bug that made earlier builds grey (visual spec 1.3).
for (const m of paletteCss.matchAll(/(--salt-[A-Za-z0-9-]+)\s*:/g)) {
  if (!defined.has(m[1])) errors.push(`${APP_TOKENS}: overrides ${m[1]}, which the theme does not define`);
}

for (const f of files) {
  const rel = relative(".", f).replaceAll("\\", "/");
  const text = readFileSync(f, "utf8");

  for (const m of text.matchAll(/var\(\s*(--salt-[A-Za-z0-9-]+)\s*(,[^)]*)?\)/g)) {
    if (defined.has(m[1])) continue;
    if (m[2] && allowFallbacks) fallbackWarnings.push(`${rel}: ${m[1]} not in theme (fallback in use)`);
    else errors.push(`${rel}: unknown Salt token ${m[1]}`);
  }
  // Template literals such as `var(--salt-spacing-${t})` are checked by the spacing probe at run time.
  for (const m of text.matchAll(/var\(\s*(--pc-[A-Za-z0-9-]+)/g)) {
    if (!appDefined.has(m[1])) errors.push(`${rel}: undefined app token ${m[1]}`);
  }

  if (extname(f) !== ".css" || rel === APP_TOKENS) continue;

  const isMono = rel.endsWith("/mono.module.css");
  const radiusExempt = /^\s*\/\*\s*radius-exempt\s*\*\//.test(text);
  const checks = [
    [/#[0-9a-fA-F]{3,8}\b/, "raw hex colour"],
    [/\b(rgb|rgba|hsl|hsla)\(/, "raw colour function"],
    [/!important/, "!important"],
    [/(^|[\s,{}])\*\s*[{,]/m, "universal selector"],
    [/\ball\s*:\s*(unset|initial)/, "all: unset/initial"],
    [/\.salt[A-Z][A-Za-z0-9_-]*/, "selector targeting Salt internals"],
    [/(^|[;{\s])(font-size|font-family|font-weight|line-height)\s*:/, "type property (use Salt type components)"],
    [/(^|[;{\s])border-radius\s*:\s*(0|[1-7]px)\s*[;}]/, "radius under 8px on a visible container (use --pc-radius-*)"],
    [/(^|[;{\s])(border-radius|box-shadow)\s*:\s*[^;]*(#[0-9a-fA-F]{3,8}|rgba?\()/, "raw colour inside radius or shadow (use --pc-shadow-*)"],
  ];
  for (const [re, label] of checks) {
    if (isMono && label.startsWith("type property")) continue;
    if (radiusExempt && label.startsWith("radius under")) continue;
    if (re.test(text)) errors.push(`${rel}: ${label}`);
  }
}

if (fallbackWarnings.length) console.warn("Fallbacks in use:\n  " + [...new Set(fallbackWarnings)].join("\n  "));
if (errors.length) {
  console.error("Token and CSS check failed:\n  " + [...new Set(errors)].join("\n  "));
  process.exit(1);
}
console.log(`OK: ${files.length} files checked, ${defined.size} Salt tokens known, ${appDefined.size} app tokens.`);
