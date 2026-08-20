import { promises as fs } from "fs";
import path from "path";
import { Word } from "./types";

// Storage backend, tried in this order:
// - REDIS_URL (standard redis:// connection string — what Vercel's "Redis" /
//   Redis Cloud marketplace integration provisions)
// - Upstash REST API vars (KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN —
//   what Vercel's older KV product / a standalone Upstash integration provisions)
// - a local JSON file, so `npm run dev` works out of the box with no setup.
// Either Redis path makes words persist across requests and be shared between
// your phone and computer; the file fallback only works for local development.

const REDIS_KEY = "english-word-trainer:words";
const DATA_FILE = path.join(process.cwd(), "data", "words.json");

type Backend = "redis-url" | "redis-rest" | "file";

function getBackend(): Backend {
  if (process.env.REDIS_URL) return "redis-url";
  const restUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (restUrl && restToken) return "redis-rest";
  return "file";
}

export function isRedisConfigured(): boolean {
  return getBackend() !== "file";
}

let tcpClientPromise: Promise<import("redis").RedisClientType> | null = null;

async function getTcpClient() {
  if (!tcpClientPromise) {
    tcpClientPromise = (async () => {
      const { createClient } = await import("redis");
      const client = createClient({ url: process.env.REDIS_URL });
      client.on("error", (err) => console.error("Redis client error", err));
      await client.connect();
      return client;
    })();
  }
  const client = await tcpClientPromise;
  if (!client.isOpen) await client.connect();
  return client;
}

let restClientPromise: Promise<import("@upstash/redis").Redis> | null = null;

async function getRestClient() {
  if (!restClientPromise) {
    restClientPromise = (async () => {
      const { Redis } = await import("@upstash/redis");
      const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN!;
      return new Redis({ url, token });
    })();
  }
  return restClientPromise;
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
  const backend = getBackend();
  if (backend === "redis-url") {
    const client = await getTcpClient();
    const raw = await client.get(REDIS_KEY);
    return raw ? (JSON.parse(raw) as Word[]) : [];
  }
  if (backend === "redis-rest") {
    const redis = await getRestClient();
    const words = await redis.get<Word[]>(REDIS_KEY);
    return words ?? [];
  }
  return readAllFromFile();
}

export async function saveAllWords(words: Word[]): Promise<void> {
  const backend = getBackend();
  if (backend === "redis-url") {
    const client = await getTcpClient();
    await client.set(REDIS_KEY, JSON.stringify(words));
    return;
  }
  if (backend === "redis-rest") {
    const redis = await getRestClient();
    await redis.set(REDIS_KEY, words);
    return;
  }
  await writeAllToFile(words);
}
