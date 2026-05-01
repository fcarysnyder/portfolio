import { promises as fs } from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { readMasterKeyB64 } from './lib/op';
import { atomicWriteJson } from './lib/atomic';
import { bytesToB64, b64ToBytes, utf8ToBytes } from '../../src/lib/crypto/codec';
import type { LockedFile, WrappedKey } from '../../src/lib/crypto/schema';

const LOCKED_PATH = path.resolve(process.cwd(), 'public/data/synthetic-readings.locked.json');

async function main() {
  const sourcePath = process.env.PRIVATE_CONTENT_PATH;
  if (!sourcePath) {
    throw new Error("PRIVATE_CONTENT_PATH not set. Point it at the source MDX file (e.g., ~/code/portfolio-private/synthetic-readings.mdx).");
  }
  let mdx: string;
  try {
    mdx = await fs.readFile(sourcePath, 'utf8');
  } catch {
    throw new Error(`Source MDX not found at ${sourcePath}. Verify the path and that the file exists.`);
  }

  const { unified } = await import('unified');
  const { default: remarkParse } = await import('remark-parse');
  const { default: remarkRehype } = await import('remark-rehype');
  const { default: rehypeStringify } = await import('rehype-stringify');
  const { default: remarkGfm } = await import('remark-gfm');

  const html = String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(mdx),
  );

  // Encrypt
  const masterB64 = readMasterKeyB64();
  const masterRaw = b64ToBytes(masterB64);
  if (masterRaw.length !== 32) throw new Error(`Master key must be 32 bytes (256-bit), got ${masterRaw.length}.`);
  const subtle = webcrypto.subtle;
  const masterKey = await subtle.importKey('raw', masterRaw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt', 'wrapKey']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, utf8ToBytes(html)));

  // Preserve any existing wrappedKeys
  let existingWrapped: WrappedKey[] = [];
  try {
    const existingRaw = await fs.readFile(LOCKED_PATH, 'utf8');
    const existing = JSON.parse(existingRaw) as LockedFile;
    existingWrapped = existing.wrappedKeys ?? [];
    console.log(`Preserving ${existingWrapped.length} existing wrapped key(s).`);
  } catch {
    console.log('No existing locked.json; starting fresh.');
  }

  const out: LockedFile = {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iterations: 600000,
    ciphertext: bytesToB64(ciphertext),
    iv: bytesToB64(iv),
    wrappedKeys: existingWrapped,
  };

  await atomicWriteJson(LOCKED_PATH, out);
  console.log(`Wrote ${LOCKED_PATH}`);
  console.log(`Source size: ${mdx.length} chars; ciphertext size: ${ciphertext.byteLength} bytes.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
