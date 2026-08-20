"use client";

import { useEffect, useMemo, useState } from "react";
import { Word } from "@/lib/types";
import { MAX_BOX } from "@/lib/srs";

export default function WordsList() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEn, setEditEn] = useState("");
  const [editRu, setEditRu] = useState("");
  const [editExample, setEditExample] = useState("");

  useEffect(() => {
    fetch("/api/words")
      .then((res) => res.json())
      .then((data) => setWords(data.words ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? words.filter((w) => w.en.toLowerCase().includes(q) || w.ru.toLowerCase().includes(q))
      : words;
    return [...list].sort((a, b) => a.en.localeCompare(b.en));
  }, [words, query]);

  function startEdit(word: Word) {
    setEditingId(word.id);
    setEditEn(word.en);
    setEditRu(word.ru);
    setEditExample(word.example ?? "");
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/words/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ en: editEn, ru: editRu, example: editExample }),
    });
    if (res.ok) {
      const { word } = await res.json();
      setWords((prev) => prev.map((w) => (w.id === id ? word : w)));
      setEditingId(null);
    }
  }

  async function deleteWord(id: string) {
    setWords((prev) => prev.filter((w) => w.id !== id));
    await fetch(`/api/words/${id}`, { method: "DELETE" });
  }

  if (loading) {
    return <p className="text-center text-slate-400 mt-16">Загрузка…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Все слова ({words.length})</h1>

      {words.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск…"
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5"
        />
      )}

      {filtered.length === 0 && (
        <p className="text-center text-slate-400 mt-10">
          {words.length === 0 ? "Список пуст" : "Ничего не найдено"}
        </p>
      )}

      <ul className="space-y-2">
        {filtered.map((word) => (
          <li key={word.id} className="rounded-xl bg-white border border-slate-200 p-3">
            {editingId === word.id ? (
              <div className="space-y-2">
                <input
                  value={editEn}
                  onChange={(e) => setEditEn(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={editRu}
                  onChange={(e) => setEditRu(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={editExample}
                  onChange={(e) => setEditExample(e.target.value)}
                  placeholder="Пример"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(word.id)}
                    className="flex-1 rounded-lg bg-indigo-600 text-white py-1.5 text-sm font-medium"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 rounded-lg border border-slate-300 py-1.5 text-sm"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {word.en} <span className="text-slate-400">—</span> {word.ru}
                  </p>
                  {word.example && (
                    <p className="text-xs text-slate-400 italic truncate">{word.example}</p>
                  )}
                  <BoxBadge box={word.box} />
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(word)}
                    className="rounded-lg px-2 py-1 text-sm text-slate-500"
                    aria-label="Редактировать"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteWord(word.id)}
                    className="rounded-lg px-2 py-1 text-sm text-red-500"
                    aria-label="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoxBadge({ box }: { box: number }) {
  const label = box >= MAX_BOX ? "выучено" : `уровень ${box}/${MAX_BOX}`;
  return (
    <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
      {label}
    </span>
  );
}
