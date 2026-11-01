import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { createZipArchive, computeCrc32 } from '../../lib/export/zip';
import { generateStandalonePortfolioHtml } from '../../lib/export/html-export';
import { exportSimplePortfolio, exportAdvancedPortfolio } from '../../lib/export/service';
import { createEmptyProfile, createDefaultDesign } from '../../lib/profile-schema';
import { createDefaultAdvancedConfig, type AdvancedPortfolioConfig } from '../../lib/portfolio-mode';

test('computeCrc32 computes accurate IEEE 802.3 CRC-32 checksums', () => {
  const empty = Buffer.alloc(0);
  assert.equal(computeCrc32(empty), 0);

  const testStr = Buffer.from('123456789', 'utf8');
  // Known standard CRC32 for "123456789" is 0xcbf43926 (3421780262)
  assert.equal(computeCrc32(testStr), 0xcbf43926);
});

test('createZipArchive generates valid PKZIP format with deflate compression', () => {
  const files = [
    { path: 'index.html', content: '<!DOCTYPE html><h1>Hello Folio</h1>' },
    { path: 'sub/nested.txt', content: 'Nested file content inside directory' },
    { path: 'binary.bin', content: Buffer.from([1, 2, 3, 4, 5]) },
  ];

  const zipBuffer = createZipArchive(files);
  assert.ok(zipBuffer.length > 0);

  // Check PKZIP local header signature: PK\x03\x04 (0x04034b50 in little endian)
  assert.equal(zipBuffer[0], 0x50); // 'P'
  assert.equal(zipBuffer[1], 0x4b); // 'K'
  assert.equal(zipBuffer[2], 0x03);
  assert.equal(zipBuffer[3], 0x04);

  // Read local header fields and verify deflate decompress works
  const pathLen = zipBuffer.readUInt16LE(26);
  const extraLen = zipBuffer.readUInt16LE(28);
  const compressedSize = zipBuffer.readUInt32LE(18);
  const filename = zipBuffer.subarray(30, 30 + pathLen).toString('utf8');
  assert.equal(filename, 'index.html');

  const compressedData = zipBuffer.subarray(30 + pathLen + extraLen, 30 + pathLen + extraLen + compressedSize);
  const decompressed = zlib.inflateRawSync(compressedData).toString('utf8');
  assert.equal(decompressed, '<!DOCTYPE html><h1>Hello Folio</h1>');
});

test('generateStandalonePortfolioHtml produces self-contained HTML and strips private data', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Alex Rivera';
  profile.basics.role = 'Product Architect';
  profile.basics.about = 'Building next-gen digital experiences & zero lock-in portfolios.';
  profile.basics.location = 'San Francisco, CA';
  profile.links.email = 'alex@example.com';
  profile.links.github = 'https://github.com/alexrivera';
  profile.links.linkedin = 'https://linkedin.com/in/alexrivera';

  profile.projects = [
    {
      id: 'proj-1',
      title: 'HyperGrid Engine',
      description: 'Distributed compute grid',
      tools: 'TypeScript, WebGPU',
      link: 'https://github.com/alexrivera/hypergrid',
    },
  ];
  profile.skills = ['TypeScript', 'Rust', 'Next.js', 'React'];
  profile.education = {
    college: 'Stanford University',
    degree: 'B.S.',
    branch: 'Computer Science',
    gradYear: '2022',
    note: '',
  };

  // Private draft notes that MUST NOT be exposed in exported static HTML
  profile.basics.originalNotes = 'INTERNAL CONFIDENTIAL RESUME NOTES - DO NOT EXPOSE TO RECRUITERS';

  const design = createDefaultDesign();
  const html = generateStandalonePortfolioHtml(profile, design, 'alex-rivera');

  // Verify structure
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('<title>Alex Rivera — Product Architect</title>'));
  assert.ok(html.includes('Alex Rivera</h1>'));
  assert.ok(html.includes('Building next-gen digital experiences'));
  assert.ok(html.includes('HyperGrid Engine</h3>'));
  assert.ok(html.includes('TypeScript'));
  assert.ok(html.includes('Stanford University'));
  assert.ok(html.includes('<style>')); // Inlined CSS

  // Privacy invariant: zero leak of originalNotes
  assert.equal(html.includes('INTERNAL CONFIDENTIAL RESUME NOTES'), false);
  assert.equal(html.includes('originalNotes'), false);

  // Security invariant: zero script tags injection
  assert.equal(html.includes('<script'), false);
});

test('exportSimplePortfolio exports both standalone HTML and static ZIP bundles', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Sarah Connor';
  const design = createDefaultDesign();

  // 1. HTML format
  const htmlResult = exportSimplePortfolio(profile, design, 'sarah-connor', 'html');
  assert.equal(htmlResult.filename, 'sarah-connor.html');
  assert.equal(htmlResult.mimeType, 'text/html; charset=utf-8');
  assert.ok(htmlResult.buffer.toString('utf8').includes('Sarah Connor'));

  // 2. ZIP format
  const zipResult = exportSimplePortfolio(profile, design, 'sarah-connor', 'zip');
  assert.equal(zipResult.filename, 'sarah-connor-static-portfolio.zip');
  assert.equal(zipResult.mimeType, 'application/zip');
  assert.equal(zipResult.buffer[0], 0x50);
  assert.equal(zipResult.buffer[1], 0x4b);
});

test('exportAdvancedPortfolio bundles complete standalone Next.js project into ZIP with zero secrets', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Devon Vance';
  profile.projects = [
    {
      id: 'p1',
      title: 'Autonomous Navigation',
      description: 'Lidar processing pipeline',
      tools: 'Rust, C++',
      link: 'https://github.com/devonvance/nav',
    },
  ];

  const advancedConfig = createDefaultAdvancedConfig();
  advancedConfig.siteTitle = 'Devon Vance Works';

  const result = exportAdvancedPortfolio(profile, advancedConfig, 'devon-vance');
  assert.equal(result.filename, 'devon-vance-nextjs-project.zip');
  assert.equal(result.mimeType, 'application/zip');
  assert.ok(result.buffer.length > 500);

  // Check PKZIP signature
  assert.equal(result.buffer[0], 0x50);
  assert.equal(result.buffer[1], 0x4b);

  // Security invariants: check exported text content for prohibited secrets
  const zipText = result.buffer.toString('latin1');
  assert.equal(zipText.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
  assert.equal(zipText.includes('VERCEL_CLIENT_SECRET'), false);
  assert.equal(zipText.includes('FOLIO_AI_API_KEY'), false);
});
