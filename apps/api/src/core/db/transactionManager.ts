import type { PrismaClient, PrismaTx } from './prisma';

export interface TransactionManager {
  run<T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T>;
}

/**
 * The only sanctioned way to open a transaction. Use-cases receive the
 * tx handle and pass it to repositories via their withTx() method — repos
 * never decide transaction boundaries themselves.
 */
export class PrismaTransactionManager implements TransactionManager {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, { timeout: 5000 });
  }
}
