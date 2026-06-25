import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const web = path.join(root, "web");
const source = path.join(root, "sto-rules.typ");
const publicDir = path.join(web, "public");
const execFileAsync = promisify(execFile);

// Читает тело в квадратных скобках
function readBracket(text, start) {
  const open = text.indexOf("[", start);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "[") depth += 1;
    if (text[i] === "]") depth -= 1;
    if (depth === 0) return { value: text.slice(open + 1, i), end: i + 1 };
  }
  return null;
}

// Читает несколько соседних тел Typst
function readConsecutiveBrackets(text, start, count) {
  const result = [];
  let cursor = start;
  for (let i = 0; i < count; i += 1) {
    const bracket = readBracket(text, cursor);
    if (!bracket) break;
    result.push(bracket);
    cursor = bracket.end;
  }
  return result;
}

// Пропускает параметры макроса перед телом
function contentStart(text, start) {
  let cursor = start;
  while (/\s/.test(text[cursor] ?? "")) cursor += 1;
  if (text[cursor] !== "(") return cursor;
  let depth = 0;
  for (let i = cursor; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    if (text[i] === ")") depth -= 1;
    if (depth === 0) return i + 1;
  }
  return cursor;
}

// Убирает простую Typst-разметку из текста
function clean(value) {
  return value
    .replace(/#\w+(?:\([^)]*\))?\[/g, "")
    .replace(/[\[\]{}]/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Читает параметры макроса в круглых скобках
function readParen(text, start) {
  const open = text.indexOf("(", start);
  const bracket = text.indexOf("[", start);
  if (open === -1 || (bracket !== -1 && bracket < open)) return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    if (text[i] === ")") depth -= 1;
    if (depth === 0) return { value: text.slice(open + 1, i), end: i + 1 };
  }
  return null;
}

// Форматирует номер в две цифры
function two(n) {
  return String(n).padStart(2, "0");
}

// Собирает имя Typst label
function label(kind, sectionNumber, itemNumber) {
  return `toc-${kind}-${sectionNumber}-${itemNumber}`;
}

// Переводит Typst pt в число
function parsePt(value) {
  if (typeof value === "number") return value;
  return Number.parseFloat(String(value).replace("pt", "")) || 0;
}

// Считает нижнюю границу подсветки
function addHighlightBounds(items) {
  const pageBottom = 780;
  const minHeight = 12;
  const samePageGap = 10;
  const sorted = [...items].sort(
    (a, b) => a.page - b.page || a.y - b.y || a.order - b.order,
  );
  for (let i = 0; i < sorted.length; i += 1) {
    const item = sorted[i];
    const next = sorted[i + 1];
    item.endPage = next?.page ?? item.page;
    item.endY =
      next?.page === item.page
        ? Math.max(item.y + minHeight, next.y - samePageGap)
        : pageBottom;
    if (next?.page === item.page && next.y - item.y < minHeight + samePageGap)
      item.endY = Math.max(item.y, next.y - samePageGap);
    item.highlightHeight = Math.max(minHeight, item.endY - item.y);
  }
}

const typSource = await readFile(source, "utf8");
const version =
  typSource.match(/#let\s+doc-version\s*=\s*"([^"]+)"/)?.[1] ?? "";
let gitCommit = "";
try {
  // Хеш нужен для информации о билде
  gitCommit = (
    await execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: root })
  ).stdout.trim();
} catch {
  gitCommit = "unknown";
}
const typ = typSource.slice(typSource.indexOf("#S["));
const tokenRe = /#(S|P|W|E|HX)\b/g;
const toc = [];
let section = null;
let sectionNo = 0;
let paramNo = 0;
let exampleNo = 0;
let order = 0;

// Сначала собираем структуру TOC из Typst
for (const match of typ.matchAll(tokenRe)) {
  const kind = match[1];
  const idx = match.index;
  if (kind === "S") {
    const title = readBracket(typ, idx);
    if (!title) continue;
    sectionNo += 1;
    paramNo = 0;
    exampleNo = 0;
    section = {
      code: String(sectionNo),
      title: clean(title.value),
      page: 1,
      y: 0,
      label: label("s", sectionNo, 0),
      items: [],
    };
    toc.push(section);
    continue;
  }
  if (!section) continue;
  if (kind === "E" || kind === "HX") {
    exampleNo += 1;
    const code = `E${two(sectionNo)}-${two(exampleNo)}`;
    section.items.push({
      code,
      kind: "example",
      title: "Пример",
      page: 1,
      y: 0,
      label: label("e", sectionNo, exampleNo),
      order: order++,
    });
    continue;
  }
  const after = idx + match[0].length;
  const params = readParen(typ, after)?.value ?? "";
  const tocMatch = params.match(/toc:\s*\[([^\]]+)\]/);
  const bodiesStart = contentStart(typ, after);
  const [first, second] = readConsecutiveBrackets(typ, bodiesStart, 2);
  if (kind === "P" && second && clean(second.value) === "") continue;
  const nextParamNo = paramNo + 1;
  const code = `P${two(sectionNo)}-${two(nextParamNo)}`;
  const title = clean(tocMatch?.[1] ?? first?.value ?? "Правило");
  if (title)
    section.items.push({
      code,
      kind: "param",
      title,
      page: 1,
      y: 0,
      label: label("p", sectionNo, nextParamNo),
      order: order++,
    });
  paramNo = nextParamNo;
}

let anchors = toc.flatMap((section) => [section, ...section.items]);
try {
  // Typst дает точные координаты по label
  const positions = {};
  const chunkSize = 25;
  for (let i = 0; i < anchors.length; i += chunkSize) {
    const chunk = anchors.slice(i, i + chunkSize);
    const expression = `(
${chunk.map((item) => `  { let found = query(<${item.label}>); ("${item.label}", if found.len() > 0 { found.first().location().position() } else { none }) },`).join("\n")}
)`;
    const { stdout } = await execFileAsync(
      "typst",
      ["eval", "--in", source, "--root", root, expression],
      { maxBuffer: 1024 * 1024 * 16 },
    );
    Object.assign(positions, Object.fromEntries(JSON.parse(stdout)));
  }
  for (const item of anchors) {
    const position = positions[item.label];
    if (!position) {
      item.missing = true;
      continue;
    }
    item.page = position.page;
    item.x = parsePt(position.x);
    item.y = parsePt(position.y);
  }
} catch (error) {
  console.warn(
    `Could not read Typst label positions: ${error.stderr || error.message}`,
  );
}

for (const section of toc) {
  // Убираем элементы без реального label
  section.items = section.items.filter((item) => !item.missing);
}
anchors = toc.flatMap((section) => [section, ...section.items]);

addHighlightBounds(anchors);

const flat = Object.fromEntries(
  toc.flatMap((section) => [
    // Flat-индекс ускоряет переходы по коду
    [
      `S${two(Number(section.code))}-00`,
      {
        code: `S${two(Number(section.code))}-00`,
        kind: "section",
        title: section.title,
        page: section.page,
        x: section.x ?? 0,
        y: section.y ?? 0,
        label: section.label,
        order: -1,
      },
    ],
    ...section.items.map((item) => [item.code, item]),
  ]),
);

await mkdir(publicDir, { recursive: true });
const generatedAt = new Date().toISOString();
await writeFile(
  path.join(publicDir, "rules-index.json"),
  JSON.stringify({ generatedAt, version, gitCommit, toc, flat }, null, 2),
);
console.log(
  `Generated ${toc.length} sections and ${Object.keys(flat).length} anchors`,
);
