import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PRIVATE_PATH =
  process.env.PORTFOLIO_PRIVATE_PATH ||
  path.join(os.homedir(), 'code', 'portfolio-private');
const DEST_ROOT = path.resolve(process.cwd(), 'public', 'assets');

async function main() {
  let entries;
  try {
    entries = await fs.readdir(PRIVATE_PATH, { withFileTypes: true });
  } catch (err) {
    console.error(
      `prepare-assets: could not read ${PRIVATE_PATH}: ${err.message}`,
    );
    console.error(
      'Set PORTFOLIO_PRIVATE_PATH or ensure ~/code/portfolio-private exists.',
    );
    process.exit(1);
  }

  const dirs = entries.filter(
    (e) => e.isDirectory() && !e.name.startsWith('.'),
  );

  if (dirs.length === 0) {
    console.log('prepare-assets: no asset directories in portfolio-private');
    return;
  }

  for (const d of dirs) {
    const src = path.join(PRIVATE_PATH, d.name);
    const dst = path.join(DEST_ROOT, d.name);
    await fs.rm(dst, { recursive: true, force: true });
    await fs.cp(src, dst, {
      recursive: true,
      filter: (s) => !path.basename(s).startsWith('.'),
    });
    console.log(`prepare-assets: ${src} → ${dst}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
