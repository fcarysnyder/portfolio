/// <reference lib="webworker" />
import { tryUnlock } from './decrypt';
import type { LockedFile } from './schema';
import type { UnlockResult } from './decrypt';

interface WorkerRequest {
  password: string;
  file: LockedFile;
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { password, file } = event.data;
  let result: UnlockResult;
  try {
    result = await tryUnlock(password, file);
  } catch {
    result = { ok: false };
  }
  (self as unknown as Worker).postMessage(result);
});

export {}; // make this a module
