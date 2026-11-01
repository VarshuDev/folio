/**
 * Pure TypeScript Vector QR Code Generator (ISO/IEC 18004 compatible).
 * Zero runtime dependencies, 100% client and server safe.
 */

// Galois Field GF(2^8) tables for Reed-Solomon error correction
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // Primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1
  }
})();

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMultiply(poly[j], factor);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);

  for (let i = 0; i < data.length; i++) {
    const lead = res[i];
    if (lead !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMultiply(gen[j], lead);
      }
    }
  }

  return res.slice(data.length);
}

// Version configs: [size, dataCapBytes, ecCount]
// Version 3 (29x29, 44 data bytes at EC Level L)
// Version 4 (33x33, 64 data bytes at EC Level L)
// Version 5 (37x37, 86 data bytes at EC Level L)
interface VersionConfig {
  version: number;
  size: number;
  dataBytes: number;
  ecBytes: number;
  alignPos: number[];
}

const VERSIONS: VersionConfig[] = [
  { version: 3, size: 29, dataBytes: 44, ecBytes: 26, alignPos: [6, 22] },
  { version: 4, size: 33, dataBytes: 64, ecBytes: 36, alignPos: [6, 26] },
  { version: 5, size: 37, dataBytes: 86, ecBytes: 48, alignPos: [6, 30] },
];

export function generateQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text);
  const version = VERSIONS.find((v) => v.dataBytes - 3 >= utf8.length) || VERSIONS[2];
  const { size, dataBytes, ecBytes, alignPos } = version;

  // 1. Bitstream encoding: 4 bits mode (0100 for Byte) + 8 bits length + data + terminator + pad
  const bitstream: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bitstream.push((val >> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(utf8.length, 8); // Character count indicator
  for (const byte of utf8) pushBits(byte, 8);
  pushBits(0, Math.min(4, dataBytes * 8 - bitstream.length)); // Terminator
  while (bitstream.length % 8 !== 0) bitstream.push(0);

  // Convert bits to bytes
  const data = new Uint8Array(dataBytes);
  for (let i = 0; i < bitstream.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bitstream[i + k];
    data[i / 8] = b;
  }

  // Pad bytes (0xEC, 0x11)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  for (let i = bitstream.length / 8; i < dataBytes; i++) {
    data[i] = padBytes[padIdx++ % 2];
  }

  // Compute Reed-Solomon ECC
  const ec = rsCompute(data, ecBytes);

  // Interleave data & ECC
  const allBits: number[] = [];
  for (const b of data) {
    for (let k = 7; k >= 0; k--) allBits.push((b >> k) & 1);
  }
  for (const b of ec) {
    for (let k = 7; k >= 0; k--) allBits.push((b >> k) & 1);
  }

  // 2. Build 2D Matrix
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  const placeFinder = (startRow: number, startCol: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = startRow + r;
        const col = startCol + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          if (r === -1 || r === 7 || c === -1 || c === 7) {
            matrix[row][col] = false;
          } else if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[row][col] = true;
          } else {
            matrix[row][col] = false;
          }
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment Pattern
  if (alignPos.length === 2) {
    const ar = alignPos[1];
    const ac = alignPos[1];
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        if (matrix[ar + r][ac + c] === null) {
          matrix[ar + r][ac + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        }
      }
    }
  }

  // Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }
  matrix[size - 8][8] = true; // Dark module

  // Reserve format info area
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
    if (size - 1 - i < size && matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (size - 1 - i < size && matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }

  // 3. Fill Data Bits in 2-column zigzag
  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const col of [right, right - 1]) {
        if (matrix[row][col] === null) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Apply Standard Mask Pattern 0: (row + col) % 2 === 0
          const mask = (row + col) % 2 === 0;
          matrix[row][col] = (bit === 1) !== mask;
        }
      }
    }
    upward = !upward;
  }

  // Format Info for Level L + Mask 0: 0x77c4
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 7; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

  return matrix.map((row) => row.map((cell) => Boolean(cell)));
}

export interface QrSvgOptions {
  size?: number;
  fgColor?: string;
  bgColor?: string;
  quietZone?: number;
}

/**
 * Generates clean, crisp vector SVG markup for a QR code.
 */
export function generateQrSvg(
  text: string,
  options: QrSvgOptions = {}
): string {
  const {
    size = 240,
    fgColor = '#365d4a',
    bgColor = '#ffffff',
    quietZone = 3,
  } = options;

  const matrix = generateQrMatrix(text);
  const matrixSize = matrix.length;
  const totalSize = matrixSize + quietZone * 2;

  let pathData = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        pathData += `M${c + quietZone},${r + quietZone}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="${bgColor}" rx="12" />
  <path d="${pathData}" fill="${fgColor}" />
</svg>`;
}
