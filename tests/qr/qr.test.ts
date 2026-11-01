import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQrMatrix, generateQrSvg } from '../../lib/qr';

test('generateQrMatrix returns valid square matrix with standard finder patterns', () => {
  const url = 'https://nive.app/p/alex-rivera';
  const matrix = generateQrMatrix(url);

  assert.ok(Array.isArray(matrix));
  assert.ok(matrix.length > 0);
  assert.equal(matrix.length, matrix[0].length, 'QR matrix must be perfectly square');

  const size = matrix.length;
  // Size must be one of standard versions (29, 33, or 37)
  assert.ok([29, 33, 37].includes(size));

  // Top-left finder pattern check: outer 7x7 perimeter is black
  for (let c = 0; c < 7; c++) {
    assert.equal(matrix[0][c], true, `Row 0, col ${c} must be dark`);
    assert.equal(matrix[6][c], true, `Row 6, col ${c} must be dark`);
  }
  for (let r = 0; r < 7; r++) {
    assert.equal(matrix[r][0], true, `Row ${r}, col 0 must be dark`);
    assert.equal(matrix[r][6], true, `Row ${r}, col 6 must be dark`);
  }

  // Top-left finder center: 3x3 box at (2..4, 2..4) is dark
  for (let r = 2; r <= 4; r++) {
    for (let c = 2; c <= 4; c++) {
      assert.equal(matrix[r][c], true, `Center (${r}, ${c}) must be dark`);
    }
  }

  // Separator ring around top-left finder center is light (false)
  assert.equal(matrix[1][1], false);
  assert.equal(matrix[1][2], false);
  assert.equal(matrix[1][5], false);
  assert.equal(matrix[5][1], false);
  assert.equal(matrix[5][5], false);
});

test('generateQrSvg outputs well-formed SVG with customizable styling', () => {
  const url = 'https://folio.new/p/sarah-creator';
  const svg = generateQrSvg(url, {
    size: 320,
    fgColor: '#123456',
    bgColor: '#abcdef',
    quietZone: 4,
  });

  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('width="320"'));
  assert.ok(svg.includes('height="320"'));
  assert.ok(svg.includes('fill="#abcdef"')); // Background
  assert.ok(svg.includes('fill="#123456"')); // Foreground path
  assert.ok(svg.includes('<path d="M'));
});

test('generateQrSvg gracefully encodes varied URLs without throwing', () => {
  const samples = [
    'https://nive.app',
    'https://nive.app/p/very-long-creator-slug-with-many-hyphens-and-details',
    'mailto:hello@example.com',
  ];

  for (const sample of samples) {
    const svg = generateQrSvg(sample);
    assert.ok(svg.length > 200);
    assert.ok(svg.includes('<path d='));
  }
});
