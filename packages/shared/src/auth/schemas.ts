import { z } from 'zod';

export const Roles = ['STUDENT', 'INSTRUCTOR', 'ADMIN'] as const;
export const roleSchema = z.enum(Roles);
export type Role = z.infer<typeof roleSchema>;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('A valid email address is required')
  .max(254);

/**
 * Password policy: length is the primary factor (NIST 800-63B) —
 * minimum 10 chars, at least one letter and one digit.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2, 'Display name is too short').max(60),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const userDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: roleSchema,
  avatarUrl: z.string().nullable(),
  locale: z.string(),
  timezone: z.string(),
  createdAt: z.string().datetime(),
});
export type UserDto = z.infer<typeof userDtoSchema>;

/** Response for register/login/refresh. The refresh token itself travels in an httpOnly cookie. */
export const authResponseSchema = z.object({
  user: userDtoSchema,
  accessToken: z.string(),
  /** Unix epoch seconds at which the access token expires. */
  accessTokenExpiresAt: z.number(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
