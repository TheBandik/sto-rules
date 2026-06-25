import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const pdfPath = path.join(root, "sto-rules.pdf");
const rulesIndexPath = path.join(root, "web", "public", "rules-index.json");
const output = path.join(root, "web", "public", "search-index.json");

const data = new Uint8Array(await readFile(pdfPath));
const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;
const pages = [];
const pageItems = new Map();

// Сначала извлекаем текст и координаты всех страниц
for (let page = 1; page <= document.numPages; page += 1) {
  const pdfPage = await document.getPage(page);
  const content = await pdfPage.getTextContent({ includeMarkedContent: false });
  const items = content.items
    .filter((item) => "str" in item && item.str.trim())
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: pdfPage.view[3] - item.transform[5],
    }));
  const text = items
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  pages.push({ page, text });
  pageItems.set(page, items);
}

const rulesIndex = JSON.parse(await readFile(rulesIndexPath, "utf8"));
const anchors = Object.values(rulesIndex.flat)
  // Поиск работает только по правилам и примерам
  .filter((item) => item.kind === "param" || item.kind === "example")
  .sort((a, b) => a.page - b.page || a.y - b.y || a.order - b.order);

const entries = anchors
  .map((anchor, index) => {
    // Текст правила режется по координатам соседних anchor
    const next = anchors[index + 1];
    const chunks = [];
    for (
      let page = anchor.page;
      page <= (anchor.endPage ?? anchor.page);
      page += 1
    ) {
      const startY = page === anchor.page ? anchor.y : 0;
      const endY =
        next?.page === page
          ? next.y
          : page === (anchor.endPage ?? anchor.page)
            ? (anchor.endY ?? 9999)
            : 9999;
      const text = (pageItems.get(page) ?? [])
        .filter((item) => item.y >= startY - 2 && item.y < endY - 2)
        .map((item) => item.text)
        .join(" ");
      if (text) chunks.push(text);
    }
    return {
      code: anchor.code,
      kind: anchor.kind,
      title: anchor.title,
      page: anchor.page,
      text: chunks.join(" ").replace(/\s+/g, " ").trim(),
    };
  })
  .filter((entry) => entry.text);

await writeFile(
  output,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), pages, entries },
    null,
    2,
  ),
);
console.log(
  `Generated search index for ${pages.length} pages and ${entries.length} rule entries`,
);
