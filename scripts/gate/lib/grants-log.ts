import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface GrantEntry {
  label: string;
  entryIndex: number;
  timestamp: string;
}

export async function appendGrant(entry: GrantEntry): Promise<void> {
  const logPath = process.env.PRIVATE_GRANTS_LOG;
  if (!logPath) {
    throw new Error("PRIVATE_GRANTS_LOG not set. Point it at a file outside the repo (e.g., ~/code/portfolio-private/grants.log.json).");
  }
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  let log: GrantEntry[] = [];
  try {
    const raw = await fs.readFile(logPath, 'utf8');
    log = JSON.parse(raw);
    if (!Array.isArray(log)) log = [];
  } catch {
    log = [];
  }
  log.push(entry);
  const tmp = `${logPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(log, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, logPath);
}
