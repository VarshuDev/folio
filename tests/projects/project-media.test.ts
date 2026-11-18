import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectSchema, safeExternalUrl } from '@/lib/profile-schema';

test('ProjectSchema: supports optional imageUrl and imageAlt with backward compatibility', () => {
  // 1. Existing project without image fields parses cleanly
  const legacy = ProjectSchema.safeParse({
    id: 'proj-1',
    title: 'Minimal Portfolio',
    description: 'Built with Next.js and TypeScript',
    tools: 'React, Next.js',
    link: 'https://github.com/example/portfolio',
  });
  assert.equal(legacy.success, true);
  if (legacy.success) {
    assert.equal(legacy.data.imageUrl, undefined);
    assert.equal(legacy.data.imageAlt, undefined);
  }

  // 2. Project with valid screenshot URL and alt description
  const withImage = ProjectSchema.safeParse({
    id: 'proj-2',
    title: 'Distributed Log Indexer',
    description: 'High throughput query engine',
    tools: 'Go, RocksDB, gRPC',
    link: 'https://github.com/example/indexer',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
    imageAlt: 'Distributed log architecture diagram and benchmark chart',
  });
  assert.equal(withImage.success, true);
  if (withImage.success) {
    assert.equal(withImage.data.imageUrl?.startsWith('https://'), true);
    assert.equal(withImage.data.imageAlt?.includes('diagram'), true);
  }

  // 3. Excessively long imageUrl (> 1000 chars) fails validation
  const tooLongUrl = ProjectSchema.safeParse({
    id: 'proj-3',
    title: 'Bad URL Project',
    description: 'Testing length validation',
    tools: 'Node',
    link: '',
    imageUrl: `https://example.com/${'a'.repeat(1000)}`,
  });
  assert.equal(tooLongUrl.success, false);

  // 4. Excessively long imageAlt (> 240 chars) fails validation
  const tooLongAlt = ProjectSchema.safeParse({
    id: 'proj-4',
    title: 'Bad Alt Project',
    description: 'Testing length validation',
    tools: 'Node',
    link: '',
    imageAlt: 'x'.repeat(241),
  });
  assert.equal(tooLongAlt.success, false);
});

test('safeExternalUrl: validates and sanitizes media URLs', () => {
  assert.equal(safeExternalUrl('https://example.com/demo.png'), 'https://example.com/demo.png');
  assert.equal(safeExternalUrl('http://cdn.folio.dev/shots/1.webp'), 'http://cdn.folio.dev/shots/1.webp');
  assert.equal(safeExternalUrl(''), null);
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('data:text/html,<script>'), null);
});
