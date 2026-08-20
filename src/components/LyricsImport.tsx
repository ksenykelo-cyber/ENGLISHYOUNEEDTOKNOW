"use client";

import { useState } from "react";
import { extractWordCandidates, WordCandidate } from "@/lib/lyricsParser";
import { translateToRu } from "@/lib/translate";

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
      done += 1;
      onProgress?.(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export default function LyricsImport({ onLinesReady }: { onLinesReady: (lines: string) => void }) {
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<WordCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  function parse() {
    setError(null);
    const found = extractWordCandidates(text);
    setCandidates(found);
    setSelected(new Set(found.map((c) => c.word)));
  }

  function toggle(word: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  async function translateSelected() {
    if (!candidates) return;
    const chosen = candidates.filter((c) => selected.has(c.word));
    if (chosen.length === 0) return;

    setTranslating(true);
    setError(null);
    setProgress({ done: 0, total: chosen.length });

    try {
      const results = await mapWithConcurrency(
        chosen,
        4,
        async (c) => {
          try {
            const ru = await translateToRu(c.word);
            return { ...c, ru };
          } catch {
            return { ...c, ru: null as string | null };
          }
        },
        (done, total) => setProgress({ done, total })
      );

      const lines = results
        .filter((r): r is WordCandidate & { ru: string } => !!r.ru)
        .map((r) => `${r.word} - ${r.ru} | ${r.context}`);

      const failedCount = results.length - lines.length;
      if (lines.length === 0) {
        setError("Не удалось перевести ни одного слова — попробуй ещё раз");
      } else {
        onLinesReady(lines.join("\n"));
        if (failedCount > 0) {
          setError(`${failedCount} слов не удалось перевести — можно добавить их вручную`);
        }
        setText("");
        setCandidates(null);
      }
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="space-y-3">
      {!candidates ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Вставь текст песни или любой другой английский текст"
            rows={8}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <p className="text-xs text-slate-400">
            Сайт найдёт незнакомые слова (пропустив базовые вроде the/a/is), переведёт их
            и добавит в список для проверки. Сам текст никуда не сохраняется.
          </p>
          <button
            onClick={parse}
            disabled={!text.trim()}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium disabled:opacity-50"
          >
            Разобрать на слова
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Найдено слов: {candidates.length}</span>
            <div className="flex gap-3">
              <button
                onClick={() => setSelected(new Set(candidates.map((c) => c.word)))}
                className="text-indigo-600"
              >
                Все
              </button>
              <button onClick={() => setSelected(new Set())} className="text-indigo-600">
                Ничего
              </button>
            </div>
          </div>

          <ul className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {candidates.map((c) => (
              <li key={c.word} className="flex items-start gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(c.word)}
                  onChange={() => toggle(c.word)}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {c.word} <span className="text-slate-400 font-normal">×{c.count}</span>
                  </p>
                  <p className="text-xs text-slate-400 truncate">{c.context}</p>
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={translateSelected}
            disabled={translating || selected.size === 0}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium disabled:opacity-50"
          >
            {translating
              ? `Перевожу… ${progress.done}/${progress.total}`
              : `Перевести и добавить (${selected.size})`}
          </button>
          <button
            onClick={() => {
              setCandidates(null);
              setError(null);
            }}
            disabled={translating}
            className="w-full rounded-xl border border-slate-300 py-2.5 text-sm text-slate-600 disabled:opacity-50"
          >
            Назад к тексту
          </button>
        </>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
