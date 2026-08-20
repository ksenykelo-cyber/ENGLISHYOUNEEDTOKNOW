import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAllWords, saveAllWords } from "@/lib/store";
import { Word } from "@/lib/types";
import { parseWordList } from "@/lib/parseImport";

export async function GET() {
  const words = await getAllWords();
  return NextResponse.json({ words });
}

function makeWord(en: string, ru: string, example?: string): Word {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    en,
    ru,
    example,
    box: 1,
    createdAt: now,
    nextReviewAt: now,
    reviewsCount: 0,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const words = await getAllWords();

  let toAdd: { en: string; ru: string; example?: string }[] = [];

  if (typeof body.bulk === "string") {
    toAdd = parseWordList(body.bulk);
    if (toAdd.length === 0) {
      return NextResponse.json(
        { error: "Не удалось распознать ни одного слова. Формат: word - перевод" },
        { status: 400 }
      );
    }
  } else if (typeof body.en === "string" && typeof body.ru === "string") {
    const en = body.en.trim();
    const ru = body.ru.trim();
    if (!en || !ru) {
      return NextResponse.json({ error: "Заполните слово и перевод" }, { status: 400 });
    }
    toAdd = [{ en, ru, example: typeof body.example === "string" ? body.example.trim() || undefined : undefined }];
  } else {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const existingEn = new Set(words.map((w) => w.en.toLowerCase()));
  const newWords: Word[] = [];
  for (const item of toAdd) {
    if (existingEn.has(item.en.toLowerCase())) continue;
    const word = makeWord(item.en, item.ru, item.example);
    newWords.push(word);
    existingEn.add(item.en.toLowerCase());
  }

  const updated = [...words, ...newWords];
  await saveAllWords(updated);

  return NextResponse.json({ added: newWords.length, skipped: toAdd.length - newWords.length, words: newWords });
}
