import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // unambiguous chars
const LENGTH = 16;

export function generatePassword(): string {
  let pw = '';
  for (let i = 0; i < LENGTH; i++) pw += ALPHABET[randomInt(ALPHABET.length)];
  return pw;
}
