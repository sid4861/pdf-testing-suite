/**
 * The SHA-256 of some bytes, as 64 lowercase hex digits.
 *
 * Web Crypto, which is in every modern browser on a secure page and in Node
 * 20 and later — so one function serves both surfaces, and a hash written by
 * the app and one written by the CLI are the same string for the same bytes.
 * That is the whole point of putting it in core: `manifest.json` and
 * `result.json` must agree about a file across machines.
 *
 * Returns undefined where `crypto.subtle` is missing or fails — on an
 * insecure origin, say. The caller records "not hashed" rather than pretending.
 */
export async function sha256(data: Uint8Array | ArrayBuffer | Blob): Promise<string | undefined> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) return undefined;

  let bytes: ArrayBuffer;
  if (data instanceof ArrayBuffer) bytes = data;
  else if (typeof Blob !== 'undefined' && data instanceof Blob) bytes = await data.arrayBuffer();
  else {
    const view = data as Uint8Array;
    bytes = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
  }

  try {
    const digest = await subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}
