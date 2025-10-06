import { config } from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  PORT: z.string().default("3000"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("1d"),
  LINE_CHANNEL_ID: z.string().optional(),
  LINE_CHANNEL_SECRET: z.string().optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  FILE_STORAGE_PATH: z.string().optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional()
});

export type AppEnvironment = z.infer<typeof envSchema>;

const buildTestDefaults = (): Partial<AppEnvironment> => {
  if (process.env.NODE_ENV !== "test") {
    return {};
  }

  return {
    DATABASE_URL:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/test?schema=public",
    REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
    SESSION_SECRET: process.env.SESSION_SECRET ?? "test-session-secret-32-characters!!",
    JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-32-characters!!!!",
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL ?? "http://localhost:3000"
  } as Partial<AppEnvironment>;
};

export const loadEnv = (options?: { path?: string }) => {
  const defaultPath = process.env.NODE_ENV === "test" ? ".env.test" : undefined;
  config({ path: options?.path ?? defaultPath });

  const merged = {
    ...buildTestDefaults(),
    ...process.env
  };

  const parsed = envSchema.safeParse(merged);

  if (!parsed.success) {
    const detail = JSON.stringify(parsed.error.flatten().fieldErrors);
    throw new Error(`Environment variable validation failed: ${detail}`);
  }

  return parsed.data;
};

export const env = loadEnv();
