import { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { logger } from "@chengyi/lib";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL
    }
  },
  log: env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["warn", "error"]
});

if (env.NODE_ENV === "development") {
  logger.info("Prisma client initialized");
}

export { prisma };
