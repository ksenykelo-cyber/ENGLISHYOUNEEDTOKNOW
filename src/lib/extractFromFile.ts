// Client-only helpers that turn an uploaded file (photo/screenshot, spreadsheet, or
// Word doc) into plain text lines in the same "word - перевод" shape the bulk
// import textarea already understands. Everything here must only run in the
// browser — heavy parsing libraries are dynamically imported so this module
// stays cheap to load until a file is actually picked.

export type ExtractProgress = (status: string) => void;

function isHeaderLikeRow(cells: string[]): boolean {
  const first = cells[0]?.toLowerCase() ?? "";
  return /^(word|слово|english|англ)/i.test(first);
}

async function extractFromImage(file: File, onProgress?: ExtractProgress): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const { data } = await Tesseract.recognize(file, "eng+rus", {
    logger: (m) => {
      if (onProgress && m.status) {
        const pct = typeof m.progress === "number" ? ` ${Math.round(m.progress * 100)}%` : "";
        onProgress(`${m.status}${pct}`);
      }
    },
  });
  return data.text;
}

async function extractFromSpreadsheet(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });

  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    rows.forEach((row, i) => {
      const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
      if (cells.length < 2) return;
      if (i === 0 && isHeaderLikeRow(cells)) return;
      const [en, ru, ...rest] = cells;
      const example = rest.join(" ").trim();
      lines.push(example ? `${en} - ${ru} | ${example}` : `${en} - ${ru}`);
    });
  }
  return lines.join("\n");
}

async function extractFromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];

  doc.querySelectorAll("table tr").forEach((tr, i) => {
    const cells = Array.from(tr.querySelectorAll("td,th"))
      .map((td) => td.textContent?.trim() ?? "")
      .filter(Boolean);
    if (cells.length < 2) return;
    if (i === 0 && isHeaderLikeRow(cells)) return;
    const [en, ru, ...rest] = cells;
    const example = rest.join(" ").trim();
    lines.push(example ? `${en} - ${ru} | ${example}` : `${en} - ${ru}`);
  });

  doc.querySelectorAll("table").forEach((t) => t.remove());
  doc.querySelectorAll("p, li").forEach((p) => {
    const text = p.textContent?.trim();
    if (text) lines.push(text);
  });

  return lines.join("\n");
}

export async function extractTextFromFile(file: File, onProgress?: ExtractProgress): Promise<string> {
  const name = file.name.toLowerCase();

  if (file.type.startsWith("image/")) {
    onProgress?.("распознаю текст на фото…");
    return extractFromImage(file, onProgress);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    onProgress?.("читаю таблицу…");
    return extractFromSpreadsheet(file);
  }
  if (name.endsWith(".docx")) {
    onProgress?.("читаю документ…");
    return extractFromDocx(file);
  }
  // csv / tsv / txt and anything else plain-text
  onProgress?.("читаю файл…");
  return file.text();
}
