import { NewWordInput } from "./types";

// Accepts pasted lists like:
//   apple - яблоко
//   run — бежать | I run every morning
//   cat, кошка
//   dog\tсобака
// One word per line. English/Russian split on the first of " - ", " — ", " – ", tab, "=" or ",".
// An optional example sentence can follow after "|".
export function parseWordList(raw: string): NewWordInput[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const separators = [" - ", " — ", " – ", "\t", " = ", ","];

  const result: NewWordInput[] = [];
  for (const line of lines) {
    const [mainPart, examplePart] = line.split("|").map((s) => s.trim());

    let splitIndex = -1;
    let sepLength = 0;
    for (const sep of separators) {
      const idx = mainPart.indexOf(sep);
      if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
        splitIndex = idx;
        sepLength = sep.length;
      }
    }

    if (splitIndex === -1) continue;

    const en = mainPart.slice(0, splitIndex).trim();
    const ru = mainPart.slice(splitIndex + sepLength).trim();
    if (!en || !ru) continue;

    result.push({ en, ru, example: examplePart || undefined });
  }

  return result;
}
