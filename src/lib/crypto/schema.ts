import { z } from 'zod';

const Base64 = z.string().regex(/^[A-Za-z0-9+/=]+$/, 'must be base64');

export const WrappedKeySchema = z.object({
  salt: Base64,
  iv: Base64,
  wrapped: Base64,
});

export const LockedFileSchema = z.object({
  v: z.literal(1),
  kdf: z.literal('pbkdf2-sha256'),
  iterations: z.number().int().min(600000),
  ciphertext: Base64,
  iv: Base64,
  wrappedKeys: z.array(WrappedKeySchema),
});

export type WrappedKey = z.infer<typeof WrappedKeySchema>;
export type LockedFile = z.infer<typeof LockedFileSchema>;
