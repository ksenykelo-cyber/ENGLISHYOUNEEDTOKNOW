"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Word } from "@/lib/types";
import { pickDueWords } from "@/lib/srs";

type LoadState = "loading" | "ready" | "error";

export default function Trainer() {
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [queue, setQueue] = useState<Word[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [sessionMode, setSessionMode] = useState<"due" | "all" | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);

  useEffect(() => {
    fetch("/api/words")
      .then((res) => res.json())
      .then((data) => {
        setAllWords(data.words ?? []);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  const dueWords = useMemo(() => pickDueWords(allWords), [allWords]);

  function startSession(mode: "due" | "all") {
    const words = mode === "due" ? dueWords : shuffle(allWords);
    setQueue(words);
    setSessionMode(mode);
    setReviewedCount(0);
    setFlipped(false);
  }

  async function answer(knewIt: boolean) {
    const current = queue[0];
    if (!current) return;

    setReviewedCount((c) => c + 1);
    fetch(`/api/words/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knewIt }),
    }).catch(() => {});

    const rest = queue.slice(1);
    const nextQueue = knewIt ? rest : [...rest, current];
    setQueue(nextQueue);
    setFlipped(false);
  }

  if (loadState === "loading") {
    return <p className="text-center text-slate-400 mt-16">Загрузка…</p>;
  }

  if (loadState === "error") {
    return (
      <p className="text-center text-red-500 mt-16">
        Не удалось загрузить слова. Попробуй обновить страницу.
      </p>
    );
  }

  if (allWords.length === 0) {
    return (
      <div className="text-center mt-16 space-y-4">
        <p className="text-4xl">📭</p>
        <p className="text-slate-500">Пока нет ни одного слова</p>
        <Link
          href="/add"
          className="inline-block rounded-xl bg-indigo-600 text-white px-5 py-2.5 font-medium"
        >
          Добавить слова
        </Link>
      </div>
    );
  }

  if (sessionMode === null) {
    return (
      <div className="mt-10 space-y-6">
        <h1 className="text-xl font-semibold">Тренировка</h1>
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-1">
          <p className="text-sm text-slate-500">Слов на сегодня</p>
          <p className="text-3xl font-bold text-indigo-600">{dueWords.length}</p>
          <p className="text-sm text-slate-400">всего в базе: {allWords.length}</p>
        </div>

        {dueWords.length > 0 ? (
          <button
            onClick={() => startSession("due")}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium"
          >
            Начать тренировку ({dueWords.length})
          </button>
        ) : (
          <p className="text-center text-slate-500">На сегодня всё повторено 🎉</p>
        )}

        <button
          onClick={() => startSession("all")}
          className="w-full rounded-xl border border-slate-300 text-slate-700 py-3 font-medium"
        >
          Повторить все слова
        </button>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="text-center mt-16 space-y-4">
        <p className="text-4xl">🎉</p>
        <p className="text-lg font-medium">Сессия завершена!</p>
        <p className="text-slate-500">Повторено карточек: {reviewedCount}</p>
        <button
          onClick={() => setSessionMode(null)}
          className="inline-block rounded-xl bg-indigo-600 text-white px-5 py-2.5 font-medium"
        >
          В меню
        </button>
      </div>
    );
  }

  const current = queue[0];

  return (
    <div className="mt-6 space-y-6">
      <p className="text-center text-sm text-slate-400">Осталось: {queue.length}</p>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="w-full min-h-[220px] rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 px-6 py-8 text-center"
      >
        {!flipped ? (
          <span className="text-3xl font-bold">{current.en}</span>
        ) : (
          <>
            <span className="text-2xl font-bold text-indigo-600">{current.ru}</span>
            {current.example && (
              <span className="text-sm text-slate-500 italic">{current.example}</span>
            )}
          </>
        )}
        <span className="text-xs text-slate-400 mt-2">
          {flipped ? "нажми, чтобы скрыть" : "нажми, чтобы увидеть перевод"}
        </span>
      </button>

      {flipped ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => answer(false)}
            className="rounded-xl bg-red-50 text-red-600 border border-red-200 py-3 font-medium"
          >
            😕 Не помню
          </button>
          <button
            onClick={() => answer(true)}
            className="rounded-xl bg-green-50 text-green-600 border border-green-200 py-3 font-medium"
          >
            😊 Помню
          </button>
        </div>
      ) : (
        <div className="h-[52px]" />
      )}
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
