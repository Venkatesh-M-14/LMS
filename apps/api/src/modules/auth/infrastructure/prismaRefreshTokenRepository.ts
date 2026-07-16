import type { PrismaClient } from '../../../core/db/prisma';
import type {
  CreateRefreshTokenInput,
  RefreshTokenRecord,
  RefreshTokenRepository,
  UserRecord,
} from '../application/ports';

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord> {
    return this.prisma.refreshToken.create({ data: input });
  }

  findByHash(tokenHash: string): Promise<(RefreshTokenRecord & { user: UserRecord }) | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  rotate(oldTokenId: string, successor: CreateRefreshTokenInput): Promise<RefreshTokenRecord> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({ data: successor });
      await tx.refreshToken.update({
        where: { id: oldTokenId },
        data: { replacedByTokenId: created.id, rotatedAt: new Date() },
      });
      return created;
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
