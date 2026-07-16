import { PrismaClient } from '@prisma/client';

export type { PrismaClient };

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ['warn', 'error'],
  });
}

/** A Prisma client scoped to an open interactive transaction. */
export type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
