// Card expressions: static reference extraction (validator C10) and sandboxed evaluation (runtime R3).
//
// An expression reads loan inputs as `i.<path>` and parameters as `P.<ID>`. Anything else it may
// touch is on a short allow-list. Evaluation runs in a separate V8 context with string code
// generation disabled and a time limit, so a reviewed card cannot reach the host or hang a check.
import vm from "node:vm";

export const TIMEOUT_MS = 50;

// Members an expression may call on values it reads.
export const METHODS = new Set(["reduce", "map", "filter", "some", "every", "find", "includes", "length", "max", "min", "round", "floor", "ceil", "abs"]);
const GLOBALS = new Set(["i", "P", "Math", "true", "false", "null", "undefined", "NaN", "Infinity"]);
const KEYWORDS = new Set(["const", "let", "return", "if", "else", "typeof"]);

const stripStrings = (s) => s.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");

/** Input paths (`loan.dti_ratio`), parameter IDs and disallowed identifiers referenced by an expression. */
export function references(expr) {
  const src = stripStrings(String(expr ?? ""));
  const paths = new Set();
  const params = new Set();
  const disallowed = new Set();

  let rest = src.replace(/\bi((?:\.[A-Za-z_]\w*)+)/g, (_, chain) => {
    const segs = chain.slice(1).split(".");
    while (segs.length > 1 && METHODS.has(segs[segs.length - 1])) segs.pop(); // i.list.reduce -> list
    paths.add(segs.join("."));
    return " ";
  });
  rest = rest.replace(/\bP\.([A-Za-z_]\w*)/g, (_, id) => { params.add(id); return " "; });

  const locals = new Set();
  for (const m of rest.matchAll(/\(([^()]*)\)\s*=>/g)) for (const n of m[1].split(",")) if (n.trim()) locals.add(n.trim());
  for (const m of rest.matchAll(/\b([A-Za-z_]\w*)\s*=>/g)) locals.add(m[1]);
  for (const m of rest.matchAll(/\b(?:const|let)\s+([A-Za-z_]\w*)/g)) locals.add(m[1]);

  // Field reads on a local, e.g. `x.qualifying_payment` inside a reduce over a collection.
  const members = new Set();
  rest = rest.replace(/(?<![.\w])([A-Za-z_]\w*)((?:\.[A-Za-z_]\w*)+)/g, (all, name, chain) => {
    if (!locals.has(name)) return all;
    const segs = chain.slice(1).split(".");
    while (segs.length && METHODS.has(segs[segs.length - 1])) segs.pop();
    if (segs.length) members.add(segs.join("."));
    return ` ${name} `;
  });

  for (const m of rest.matchAll(/(\.)?\b([A-Za-z_]\w*)(?=(\s*:(?!:))?)/g)) {
    const [, dot, name, key] = m;
    if (dot) { if (!METHODS.has(name)) disallowed.add(`.${name}`); continue; }
    if (key) continue; // object literal key, e.g. ({ student_loan: P.X })
    if (!GLOBALS.has(name) && !KEYWORDS.has(name) && !locals.has(name)) disallowed.add(name);
  }
  return { paths: [...paths], params: [...params], members: [...members], disallowed: [...disallowed] };
}

let context;
function sandbox() {
  context ??= vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  return context;
}
const compiled = new Map();

/** Evaluate `expr` with inputs `i` and parameters `P` in the sandbox. Throws on error or timeout. */
export function run(expr, i, P) {
  let script = compiled.get(expr);
  if (!script) {
    script = new vm.Script(`(function (i, P) { "use strict"; return (${expr}); })`, { filename: "card-expr" });
    compiled.set(expr, script);
  }
  const fn = script.runInContext(sandbox(), { timeout: TIMEOUT_MS });
  // The call itself is guarded by a second context run so a slow expression is also cut off.
  const ctx = sandbox();
  ctx.__fn = fn; ctx.__i = i; ctx.__P = P;
  try {
    return callScript.runInContext(ctx, { timeout: TIMEOUT_MS });
  } finally {
    delete ctx.__fn; delete ctx.__i; delete ctx.__P;
  }
}
const callScript = new vm.Script("__fn(__i, __P)");
