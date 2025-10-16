import { z } from "zod";
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "staging", "production"]>>;
    PORT: z.ZodDefault<z.ZodString>;
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodString;
    SESSION_SECRET: z.ZodString;
    JWT_SECRET: z.ZodString;
    JWT_EXPIRES_IN: z.ZodDefault<z.ZodString>;
    LINE_CHANNEL_ID: z.ZodOptional<z.ZodString>;
    LINE_CHANNEL_SECRET: z.ZodOptional<z.ZodString>;
    LINE_CHANNEL_ACCESS_TOKEN: z.ZodOptional<z.ZodString>;
    FILE_STORAGE_PATH: z.ZodOptional<z.ZodString>;
    PUBLIC_APP_URL: z.ZodOptional<z.ZodString>;
    GOOGLE_MAPS_API_KEY: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "staging" | "production";
    PORT: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    SESSION_SECRET: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    LINE_CHANNEL_ID?: string | undefined;
    LINE_CHANNEL_SECRET?: string | undefined;
    LINE_CHANNEL_ACCESS_TOKEN?: string | undefined;
    FILE_STORAGE_PATH?: string | undefined;
    PUBLIC_APP_URL?: string | undefined;
    GOOGLE_MAPS_API_KEY?: string | undefined;
}, {
    DATABASE_URL: string;
    REDIS_URL: string;
    SESSION_SECRET: string;
    JWT_SECRET: string;
    NODE_ENV?: "development" | "test" | "staging" | "production" | undefined;
    PORT?: string | undefined;
    JWT_EXPIRES_IN?: string | undefined;
    LINE_CHANNEL_ID?: string | undefined;
    LINE_CHANNEL_SECRET?: string | undefined;
    LINE_CHANNEL_ACCESS_TOKEN?: string | undefined;
    FILE_STORAGE_PATH?: string | undefined;
    PUBLIC_APP_URL?: string | undefined;
    GOOGLE_MAPS_API_KEY?: string | undefined;
}>;
export type AppEnvironment = z.infer<typeof envSchema>;
export declare const loadEnv: (options?: {
    path?: string;
}) => {
    NODE_ENV: "development" | "test" | "staging" | "production";
    PORT: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    SESSION_SECRET: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    LINE_CHANNEL_ID?: string | undefined;
    LINE_CHANNEL_SECRET?: string | undefined;
    LINE_CHANNEL_ACCESS_TOKEN?: string | undefined;
    FILE_STORAGE_PATH?: string | undefined;
    PUBLIC_APP_URL?: string | undefined;
    GOOGLE_MAPS_API_KEY?: string | undefined;
};
export declare const env: {
    NODE_ENV: "development" | "test" | "staging" | "production";
    PORT: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    SESSION_SECRET: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    LINE_CHANNEL_ID?: string | undefined;
    LINE_CHANNEL_SECRET?: string | undefined;
    LINE_CHANNEL_ACCESS_TOKEN?: string | undefined;
    FILE_STORAGE_PATH?: string | undefined;
    PUBLIC_APP_URL?: string | undefined;
    GOOGLE_MAPS_API_KEY?: string | undefined;
};
export default env;
//# sourceMappingURL=index.d.ts.map