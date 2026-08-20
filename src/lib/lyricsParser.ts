// Turns any pasted English text (song lyrics, a paragraph, etc.) into a list of
// candidate vocabulary words: unique, common filler words stripped out, sorted
// by how often they repeat, each with the line it first appeared in as context.
// Runs entirely client-side on whatever text the user pastes — nothing is sent
// anywhere until they choose to translate specific words.

const STOPWORDS = new Set(
  `a an the and or but nor so yet
   i you he she it we they me him her us them my your his its our their mine yours hers ours theirs
   this that these those
   is am are was were be been being
   do does did doing done
   have has had having
   will would shall should can could may might must
   to of in on at by for with from into onto up down out off over under again further
   here there when where why how all any both each few more most other some such
   only own same so than too very just
   not no nor
   as if then once
   oh yeah yo na la ooh ah hey uh um whoa gonna wanna gotta ain't
   let lets let's
   im ive youre youve theyre theyve dont doesnt didnt isnt arent wasnt werent
   cant couldnt wont wouldnt shouldnt hasnt havent hadnt`
    .split(/\s+/)
    .filter(Boolean)
);

export type WordCandidate = {
  word: string;
  count: number;
  context: string;
};

export function extractWordCandidates(text: string): WordCandidate[] {
  const lines = text.split("\n");
  const map = new Map<string, WordCandidate>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const matches = line.match(/[a-zA-Z]+(?:'[a-zA-Z]+)?/g) ?? [];
    for (const match of matches) {
      const word = match.toLowerCase();
      if (word.length < 3 || STOPWORDS.has(word)) continue;
      const existing = map.get(word);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(word, { word, count: 1, context: line });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}
