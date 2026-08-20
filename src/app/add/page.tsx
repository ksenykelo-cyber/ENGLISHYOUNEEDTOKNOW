"use client";

import { useState } from "react";

type Mode = "single" | "bulk";
type Status = { type: "success" | "error"; text: string } | null;

export default function AddPage() {
  const [mode, setMode] = useState<Mode>("single");

  const [en, setEn] = useState("");
  const [ru, setRu] = useState("");
  const [example, setExample] = useState("");

  const [bulk, setBulk] = useState("");

  const [status, setStatus] = useState<Status>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!en.trim() || !ru.trim()) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ en, ru, example }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      if (data.added === 0) {
        setStatus({ type: "error", text: "Такое слово уже есть в списке" });
      } else {
        setStatus({ type: "success", text: `Добавлено: ${en}` });
        setEn("");
        setRu("");
        setExample("");
      }
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Ошибка" });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitBulk(e: React.FormEvent) {
    e.preventDefault();
    if (!bulk.trim()) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setStatus({
        type: "success",
        text: `Добавлено слов: ${data.added}${data.skipped ? `, пропущено дублей: ${data.skipped}` : ""}`,
      });
      setBulk("");
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Ошибка" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Добавить слова</h1>

      <div className="flex rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setMode("single")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            mode === "single" ? "bg-white shadow text-slate-900" : "text-slate-500"
          }`}
        >
          Одно слово
        </button>
        <button
          onClick={() => setMode("bulk")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            mode === "bulk" ? "bg-white shadow text-slate-900" : "text-slate-500"
          }`}
        >
          Списком
        </button>
      </div>

      {mode === "single" ? (
        <form onSubmit={submitSingle} className="space-y-3">
          <input
            value={en}
            onChange={(e) => setEn(e.target.value)}
            placeholder="Слово на английском"
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
            autoCapitalize="none"
          />
          <input
            value={ru}
            onChange={(e) => setRu(e.target.value)}
            placeholder="Перевод"
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={example}
            onChange={(e) => setExample(e.target.value)}
            placeholder="Пример предложения (необязательно)"
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />
          <button
            type="submit"
            disabled={submitting || !en.trim() || !ru.trim()}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium disabled:opacity-50"
          >
            Добавить
          </button>
        </form>
      ) : (
        <form onSubmit={submitBulk} className="space-y-3">
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Вставь список, по одному слову в строке:\napple - яблоко\nrun — бежать | I run every morning\ncat, кошка"}
            rows={10}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm"
          />
          <p className="text-xs text-slate-400">
            Формат: <code>слово - перевод</code>, разделитель может быть тире, запятой или табом.
            После <code>|</code> можно добавить пример предложения.
          </p>
          <button
            type="submit"
            disabled={submitting || !bulk.trim()}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium disabled:opacity-50"
          >
            Добавить список
          </button>
        </form>
      )}

      {status && (
        <p className={status.type === "success" ? "text-green-600 text-sm" : "text-red-500 text-sm"}>
          {status.text}
        </p>
      )}
    </div>
  );
}
