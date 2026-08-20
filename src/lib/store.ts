import { promises as fs } from "fs";
import path from "path";
import { Word } from "./types";

// Storage backend:
// - On Vercel (or anywhere with Redis env vars set), words are stored in Upstash Redis
//   so they persist across requests and are shared between your phone and computer.
// - Locally, without those env vars, words are stored in a JSON file on disk so
//   `npm run dev` works out of the box with no setup.

const REDIS_KEY = "english-word-trainer:words";
const DATA_FILE = path.join(process.cwd(), "data", "words.json");

function getRedisCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return { url, token };
  return null;
}

export function isRedisConfigured(): boolean {
  return getRedisCredentials() !== null;
}

let redisClientPromise: Promise<import("@upstash/redis").Redis> | null = null;

async function getRedis() {
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const { Redis } = await import("@upstash/redis");
      const creds = getRedisCredentials();
      if (!creds) throw new Error("Redis is not configured");
      return new Redis({ url: creds.url, token: creds.token });
    })();
  }
  return redisClientPromise;
}

async function readAllFromFile(): Promise<Word[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as Word[];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAllToFile(words: Word[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(words, null, 2), "utf-8");
}

export async function getAllWords(): Promise<Word[]> {
  if (isRedisConfigured()) {
    const redis = await getRedis();
    const words = await redis.get<Word[]>(REDIS_KEY);
    return words ?? [];
  }
  return readAllFromFile();
}

export async function saveAllWords(words: Word[]): Promise<void> {
  if (isRedisConfigured()) {
    const redis = await getRedis();
    await redis.set(REDIS_KEY, words);
    return;
  }
  await writeAllToFile(words);
}
