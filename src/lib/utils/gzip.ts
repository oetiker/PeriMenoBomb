// Native gzip via the Compression Streams API — no dependency. Backups are
// gzip so the magic bytes (1f 8b) let restore auto-detect compression.
export function encodeText(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function decodeText(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

async function pipe(data: Uint8Array, transform: ReadableWritablePair): Promise<Uint8Array> {
  // Uint8Array satisfies BlobPart; cast required by the project's strict tsconfig.
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function gzip(data: Uint8Array): Promise<Uint8Array> {
  return pipe(data, new CompressionStream('gzip'));
}

export function gunzip(data: Uint8Array): Promise<Uint8Array> {
  return pipe(data, new DecompressionStream('gzip'));
}

export function isGzip(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}
