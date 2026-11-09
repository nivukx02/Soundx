import fs from 'node:fs';
import path from 'node:path';
import { ProviderError } from './errors.js';
import { isPathInside, safeName, sha256File } from './utils.js';

function extension(candidate) {
  const format = candidate.format?.replace(/^\./, '');
  if (format && /^[a-z0-9]{2,8}$/.test(format)) return format === 'wave' ? 'wav' : format;
  const media = candidate.mediaType;
  if (media === 'audio/wav' || media === 'audio/wave' || media === 'audio/x-wav') return 'wav';
  if (media === 'audio/flac' || media === 'audio/x-flac') return 'flac';
  return 'bin';
}

function strictBase64(value) {
  const compact = value.replace(/\s/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) {
    throw new ProviderError('Candidate contains malformed base64 audio data');
  }
  return Buffer.from(compact, 'base64');
}

async function download(url, destination, provider) {
  if (!provider.permitsArtifactUrl(url)) throw new ProviderError(`Provider artifact URL is not permitted: ${new URL(url).origin}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Artifact download timed out')), provider.configuration.jobTimeoutMs);
  let handle;
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new ProviderError(`Artifact download returned HTTP ${response.status}`);
    if (!provider.permitsArtifactUrl(response.url)) throw new ProviderError('Artifact redirect target is not permitted');
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > provider.configuration.maxArtifactBytes) throw new ProviderError('Artifact exceeds configured size limit');
    handle = await fs.promises.open(destination, 'wx');
    let bytes = 0;
    for await (const chunk of response.body ?? []) {
      bytes += chunk.length;
      if (bytes > provider.configuration.maxArtifactBytes) throw new ProviderError('Artifact exceeds configured size limit');
      await handle.write(chunk);
    }
    if (bytes === 0) throw new ProviderError('Provider artifact is empty');
    return bytes;
  } finally {
    clearTimeout(timer);
    await handle?.close().catch(() => {});
  }
}

export async function materializeCandidate(candidate, directory, provider) {
  await fs.promises.mkdir(directory, { recursive: true });
  const destination = path.join(directory, `${safeName(candidate.id, 'candidate')}.${extension(candidate)}`);
  try {
    if (candidate.artifact.kind === 'base64') {
      const buffer = strictBase64(candidate.artifact.data);
      if (!buffer.length || buffer.length > provider.configuration.maxArtifactBytes) throw new ProviderError('Base64 artifact has an invalid size');
      await fs.promises.writeFile(destination, buffer, { flag: 'wx' });
    } else if (candidate.artifact.kind === 'path') {
      if (provider.configuration.mode !== 'local' || !provider.configuration.localArtifactRoot) {
        throw new ProviderError('Path artifacts require a local provider and NIV_AI_LOCAL_ARTIFACT_ROOT');
      }
      const source = path.resolve(candidate.artifact.path);
      if (!isPathInside(provider.configuration.localArtifactRoot, source)) throw new ProviderError('Local artifact path escapes NIV_AI_LOCAL_ARTIFACT_ROOT');
      const stats = await fs.promises.stat(source);
      if (!stats.isFile() || stats.size === 0 || stats.size > provider.configuration.maxArtifactBytes) throw new ProviderError('Local artifact has an invalid size');
      await fs.promises.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
    } else {
      await download(candidate.artifact.url, destination, provider);
    }
    const sha256 = await sha256File(destination);
    if (candidate.expectedSha256 && candidate.expectedSha256 !== sha256) throw new ProviderError('Candidate hash does not match provider provenance');
    const stats = await fs.promises.stat(destination);
    return { path: destination, sha256, bytes: stats.size, format: extension(candidate) };
  } catch (error) {
    await fs.promises.rm(destination, { force: true }).catch(() => {});
    throw error;
  }
}
