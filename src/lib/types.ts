export type Word = {
  id: string;
  en: string;
  ru: string;
  example?: string;
  box: number; // 1..5, Leitner box
  createdAt: string; // ISO
  nextReviewAt: string; // ISO
  reviewsCount: number;
  lastResult?: "know" | "dont-know";
};

export type NewWordInput = {
  en: string;
  ru: string;
  example?: string;
};
