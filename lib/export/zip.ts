import zlib from 'node:zlib';

export interface ZipFileInput {
  path: string;
  content: string | Buffer | Uint8Array;
}

// Precomputed CRC32 table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates a valid, standard PKZIP archive Buffer from an array of files.
 * Uses Deflate compression with UTF-8 path support and zero external dependencies.
 */
export function createZipArchive(files: ZipFileInput[]): Buffer {
  const localChunks: Buffer[] = [];
  const cdChunks: Buffer[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const rawData =
      typeof file.content === 'string'
        ? Buffer.from(file.content, 'utf8')
        : Buffer.isBuffer(file.content)
        ? file.content
        : Buffer.from(file.content);

    const compressedData = zlib.deflateRawSync(rawData);
    const uncompressedSize = rawData.length;
    const compressedSize = compressedData.length;
    const crc = computeCrc32(rawData);

    // Normalize path separators to forward slashes without leading slash
    const normalizedPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const pathBuffer = Buffer.from(normalizedPath, 'utf8');
    const pathLength = pathBuffer.length;

    // --- 1. Local File Header ---
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4); // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // Flags: UTF-8 filename (bit 11)
    localHeader.writeUInt16LE(8, 8); // Compression method: Deflate
    localHeader.writeUInt16LE(0, 10); // Time (00:00:00)
    localHeader.writeUInt16LE(0x5421, 12); // Date (2022-01-01)
    localHeader.writeUInt32LE(crc, 14); // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(pathLength, 26); // Filename length
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localChunks.push(localHeader, pathBuffer, compressedData);

    // --- 2. Central Directory Header ---
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // Signature
    cdHeader.writeUInt16LE(20, 4); // Version made by
    cdHeader.writeUInt16LE(20, 6); // Version needed (2.0)
    cdHeader.writeUInt16LE(0x0800, 8); // Flags: UTF-8
    cdHeader.writeUInt16LE(8, 10); // Compression method: Deflate
    cdHeader.writeUInt16LE(0, 12); // Time
    cdHeader.writeUInt16LE(0x5421, 14); // Date
    cdHeader.writeUInt32LE(crc, 16); // CRC-32
    cdHeader.writeUInt32LE(compressedSize, 20); // Compressed size
    cdHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
    cdHeader.writeUInt16LE(pathLength, 28); // Filename length
    cdHeader.writeUInt16LE(0, 30); // Extra field length
    cdHeader.writeUInt16LE(0, 32); // File comment length
    cdHeader.writeUInt16LE(0, 34); // Disk number start
    cdHeader.writeUInt16LE(0, 36); // Internal file attributes
    cdHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38); // External file attributes (-rw-r--r--)
    cdHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header

    cdChunks.push(cdHeader, pathBuffer);

    currentOffset += localHeader.length + pathBuffer.length + compressedData.length;
  }

  const centralDirectoryOffset = currentOffset;
  const centralDirectoryBuffer = Buffer.concat(cdChunks);
  const centralDirectorySize = centralDirectoryBuffer.length;
  const totalEntries = files.length;

  // --- 3. End of Central Directory Record (EOCD) ---
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Disk with central directory
  eocd.writeUInt16LE(totalEntries, 8); // Number of entries on this disk
  eocd.writeUInt16LE(totalEntries, 10); // Total entries
  eocd.writeUInt32LE(centralDirectorySize, 12); // Size of central directory
  eocd.writeUInt32LE(centralDirectoryOffset, 16); // Offset of central directory
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localChunks, centralDirectoryBuffer, eocd]);
}
