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

// Maps table/spreadsheet columns to word / translation / example by header name,
// so a 4th "translated example" column (common in AI-generated word lists) isn't
// blindly concatenated into the example text alongside the English one.
type ColumnMap = { en: number; ru: number; example: number };

function mapColumnsByHeader(header: string[]): ColumnMap | null {
  const lower = header.map((h) => h.toLowerCase());

  const find = (patterns: RegExp[], exclude: RegExp[] = []) =>
    lower.findIndex((h) => !exclude.some((p) => p.test(h)) && patterns.some((p) => p.test(h)));

  const en = find([/^word$/, /^english$/, /слово/, /англ/]);
  const ru = find([/^translation$/, /^russian$/, /перевод/, /рус/], [/context/, /пример/, /sentence/]);
  const example = find([/context/, /example/, /пример/, /sentence/, /предложение/], [/translat/, /перевод/]);

  if (en === -1 || ru === -1) return null;
  return { en, ru, example };
}

function rowsToLines(rows: string[][]): string[] {
  const lines: string[] = [];
  if (rows.length === 0) return lines;

  const header = isHeaderLikeRow(rows[0]) ? rows[0] : null;
  const columns = header ? mapColumnsByHeader(header) : null;
  const dataRows = header ? rows.slice(1) : rows;

  for (const row of dataRows) {
    if (columns) {
      const en = (row[columns.en] ?? "").trim();
      const ru = (row[columns.ru] ?? "").trim();
      const example = columns.example !== -1 ? (row[columns.example] ?? "").trim() : "";
      if (en && ru) {
        lines.push(example ? `${en} - ${ru} | ${example}` : `${en} - ${ru}`);
        continue;
      }
    } else if (row.length >= 2) {
      const [en = "", ru = "", example = ""] = row.map((c) => c.trim());
      if (en && ru) {
        lines.push(example ? `${en} - ${ru} | ${example}` : `${en} - ${ru}`);
        continue;
      }
    }
    // Not enough columns to confidently split — keep the raw text so the
    // flexible bulk parser can still pick a "word - перевод" pair out of it.
    const raw = row.join(" ").trim();
    if (raw) lines.push(raw);
  }

  return lines;
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
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })
      .map((row) => row.map((c) => String(c ?? "").trim()))
      .filter((row) => row.some(Boolean));
    lines.push(...rowsToLines(rows));
  }
  return lines.join("\n");
}

async function extractFromCsv(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const text = await file.text();
  const workbook = XLSX.read(text, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })
    .map((row) => row.map((c) => String(c ?? "").trim()))
    .filter((row) => row.some(Boolean));
  return rowsToLines(rows).join("\n");
}

async function extractFromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];

  doc.querySelectorAll("table").forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td,th")).map((td) => td.textContent?.trim() ?? "")
    );
    lines.push(...rowsToLines(rows));
  });

  doc.querySelectorAll("table").forEach((t) => t.remove());
  doc.querySelectorAll("p, li").forEach((p) => {
    const text = p.textContent?.trim();
    if (text) lines.push(text);
  });

  return lines.join("\n");
}

async function extractFromScannedPdf(
  pdf: import("pdfjs-dist").PDFDocumentProxy,
  onProgress?: ExtractProgress
): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const { data } = await Tesseract.recognize(canvas, "eng+rus", {
      logger: (m) => {
        if (onProgress && m.status) {
          const pct = typeof m.progress === "number" ? ` ${Math.round(m.progress * 100)}%` : "";
          onProgress(`скан, стр. ${pageNum}/${pdf.numPages}: ${m.status}${pct}`);
        }
      },
    });
    lines.push(data.text);
  }

  return lines.join("\n");
}

async function extractFromPdf(file: File, onProgress?: ExtractProgress): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const allLines: string[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(`читаю страницу ${pageNum}/${pdf.numPages}…`);
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // PDFs have no real "lines" — reconstruct them by bucketing text items
    // that sit at (roughly) the same vertical position, then order left to right.
    const lineMap = new Map<number, { x: number; str: string }[]>();
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      const bucket = lineMap.get(y) ?? [];
      bucket.push({ x: item.transform[4], str: item.str });
      lineMap.set(y, bucket);
    }

    const pageLines = Array.from(lineMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) =>
        parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.str)
          .join(" ")
          .trim()
      )
      .filter(Boolean);

    allLines.push(...pageLines);
    totalChars += pageLines.join("").length;
  }

  if (totalChars < 20) {
    onProgress?.("текстовый слой не найден — распознаю как скан…");
    return extractFromScannedPdf(pdf, onProgress);
  }

  return allLines.join("\n");
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
  if (name.endsWith(".csv")) {
    onProgress?.("читаю таблицу…");
    return extractFromCsv(file);
  }
  if (name.endsWith(".docx")) {
    onProgress?.("читаю документ…");
    return extractFromDocx(file);
  }
  if (name.endsWith(".pdf")) {
    onProgress?.("открываю PDF…");
    return extractFromPdf(file, onProgress);
  }
  // tsv / txt and anything else plain-text
  onProgress?.("читаю файл…");
  return file.text();
}
