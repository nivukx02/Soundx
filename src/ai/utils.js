import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

export async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return `sha256:${hash.digest('hex')}`;
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashJson(value) {
  return sha256Buffer(Buffer.from(stableJson(value), 'utf8'));
}

export async function readJson(filePath) {
  const value = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${filePath} must contain a JSON object`);
  }
  return value;
}

export async function writeJson(filePath, value, { overwrite = true } = {}) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (!overwrite) {
    await fs.promises.writeFile(filePath, body, { encoding: 'utf8', flag: 'wx' });
    return;
  }
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.promises.writeFile(temporary, body, { encoding: 'utf8', flag: 'wx' });
    await fs.promises.rename(temporary, filePath);
  } catch (error) {
    await fs.promises.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function assertNewFile(filePath, overwrite = false) {
  if (overwrite) return;
  try {
    await fs.promises.access(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`Refusing to overwrite existing artifact: ${filePath}`);
}

export function safeName(value, fallback = 'artifact') {
  const cleaned = String(value ?? '').normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 96) || fallback;
}

export function parsePositiveInteger(value, label, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new TypeError(`${label} must be a positive integer`);
  return parsed;
}

export function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export function isPathInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function delay(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new Error('Operation aborted'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error('Operation aborted'));
    }, { once: true });
  });
}

export function finiteNumber(value, fallback = null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
