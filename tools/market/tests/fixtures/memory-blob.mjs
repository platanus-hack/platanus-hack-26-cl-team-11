// The HTTP integration test imports the production API and transaction code. Only Blob I/O is replaced.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@vercel/blob') return { url: import.meta.url, shortCircuit: true };
  return nextResolve(specifier, context);
}

const blobs = new Map();
export class BlobPreconditionFailedError extends Error {}

export async function get(path) {
  const saved = blobs.get(path);
  return saved ? { stream: new Blob([saved.content]).stream(), blob: { etag: saved.etag } } : null;
}

export async function put(path, content, options) {
  const saved = blobs.get(path);
  if (saved && !options.ifMatch && !options.allowOverwrite) throw Error('Blob already exists');
  if (options.ifMatch && options.ifMatch !== saved?.etag) throw new BlobPreconditionFailedError();
  blobs.set(path, { content, etag: String(Number(saved?.etag ?? 0) + 1) });
}
