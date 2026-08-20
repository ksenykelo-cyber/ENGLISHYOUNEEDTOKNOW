import { NextRequest, NextResponse } from "next/server";
import { getAllWords, saveAllWords } from "@/lib/store";
import { applyAnswer } from "@/lib/srs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const words = await getAllWords();
  const index = words.findIndex((w) => w.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Слово не найдено" }, { status: 404 });
  }

  let updatedWord = words[index];

  if (typeof body.knewIt === "boolean") {
    updatedWord = applyAnswer(updatedWord, body.knewIt);
  }

  if (typeof body.en === "string" && body.en.trim()) updatedWord = { ...updatedWord, en: body.en.trim() };
  if (typeof body.ru === "string" && body.ru.trim()) updatedWord = { ...updatedWord, ru: body.ru.trim() };
  if (typeof body.example === "string") updatedWord = { ...updatedWord, example: body.example.trim() || undefined };

  const words2 = [...words];
  words2[index] = updatedWord;
  await saveAllWords(words2);

  return NextResponse.json({ word: updatedWord });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const words = await getAllWords();
  const filtered = words.filter((w) => w.id !== id);
  if (filtered.length === words.length) {
    return NextResponse.json({ error: "Слово не найдено" }, { status: 404 });
  }
  await saveAllWords(filtered);
  return NextResponse.json({ ok: true });
}
