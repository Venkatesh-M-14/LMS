import { Prisma } from '@prisma/client';
import { ErrorCodes } from '@academy/shared';
import { ConflictError } from '../../../core/errors/appError';
import type { PrismaClient } from '../../../core/db/prisma';
import type { CreateUserInput, UserRecord, UserRepository } from '../application/ports';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({ data: input });
    } catch (error) {
      // Unique-constraint race: two concurrent registrations for one email.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(
          'An account with this email already exists',
          ErrorCodes.EMAIL_ALREADY_REGISTERED,
        );
      }
      throw error;
    }
  }
}
