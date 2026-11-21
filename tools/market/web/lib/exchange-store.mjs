import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

const ledger = 'exchange/26-cl/v1.json';

// A private origin read and a conditional replacement are one optimistic transaction.
// Each retry gets a fresh copy, including any successful nonce receipt from another invocation.
export async function transact(create, update) {
  for (let attempt = 0; attempt < 9; attempt++) {
    // Compressed responses carry weak ETags, which cannot guard a conditional write.
    const stored = await get(ledger, { access: 'private', useCache: false, headers: { 'Accept-Encoding': 'identity' } });
    const state = stored ? await new Response(stored.stream).json() : create();
    const { changed, result } = await update(state);
    if (!changed && stored) return result;
    try {
      await put(ledger, JSON.stringify(state), {
        access: 'private', addRandomSuffix: false, contentType: 'application/json',
        ...(stored ? { ifMatch: stored.blob.etag } : { allowOverwrite: false }),
      });
      return result;
    } catch (err) {
      if (!(err instanceof BlobPreconditionFailedError) && !(stored === null && /already exists/i.test(err.message))) throw err;
      await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * (attempt + 1) * 40));
    }
  }
  throw Object.assign(new Error('Hay varias órdenes en curso. Reintenta con el mismo identificador.'), { status: 503 });
}
