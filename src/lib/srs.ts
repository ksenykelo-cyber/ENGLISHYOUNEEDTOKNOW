import { Word } from "./types";

// Simple Leitner-system spaced repetition: 5 boxes, each with a review interval.
// Box 1 = just learned / got wrong, reviewed daily. Box 5 = well known, reviewed rarely.
const BOX_INTERVAL_DAYS: Record<number, number> = {
  1: 0, // due immediately
  2: 1,
  3: 3,
  4: 7,
  5: 16,
};

export const MAX_BOX = 5;

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function nextReviewDate(box: number, from: Date = new Date()): Date {
  const days = BOX_INTERVAL_DAYS[box] ?? 0;
  return addDays(from, days);
}

export function applyAnswer(word: Word, knewIt: boolean, now: Date = new Date()): Word {
  const box = knewIt ? Math.min(word.box + 1, MAX_BOX) : 1;
  return {
    ...word,
    box,
    nextReviewAt: nextReviewDate(box, now).toISOString(),
    reviewsCount: word.reviewsCount + 1,
    lastResult: knewIt ? "know" : "dont-know",
  };
}

export function isDue(word: Word, now: Date = new Date()): boolean {
  return new Date(word.nextReviewAt).getTime() <= now.getTime();
}

export function pickDueWords(words: Word[], now: Date = new Date()): Word[] {
  return words
    .filter((w) => isDue(w, now))
    .sort((a, b) => a.box - b.box || new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime());
}
