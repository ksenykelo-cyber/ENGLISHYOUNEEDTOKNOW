// Free, keyless machine translation via MyMemory (https://mymemory.translated.net).
// Quality is "good enough to review", not perfect — results are meant to be
// checked/edited by the user before they're saved as flashcards, same as the
// other import paths in this app.

export async function translateToRu(text: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Translation service unavailable");
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (typeof translated !== "string" || !translated) throw new Error("No translation returned");
  return translated;
}
