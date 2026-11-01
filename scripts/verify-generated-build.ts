import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { generateAdvancedProject } from '../lib/advanced-generator';
import { createDefaultPortfolioConfig } from '../lib/portfolio-mode';

const sampleProfile = {
  schemaVersion: 1 as const,
  basics: {
    name: 'Ada Lovelace',
    role: 'Computing Pioneer & Algorithm Architect',
    about: 'First computer programmer, analyzing mechanical computation and universal calculating engines.',
    location: 'London, UK',
    originalNotes: 'Private notes that must never be published.',
  },
  education: {
    college: 'University of London',
    degree: 'Studies in Mathematics',
    branch: 'Mathematics & Mechanics',
    gradYear: '1840',
    note: 'Private tutoring under Augustus De Morgan',
  },
  skills: ['Mathematical Logic', 'Analytical Engines', 'Symbolic Calculation', 'Algorithm Design'],
  interests: ['Calculus', 'Bernoulli Numbers', 'Music Synthesis'],
  projects: [
    {
      id: 'proj-1',
      title: 'Note G: Bernoulli Numbers Algorithm',
      description: 'First algorithm designed to be carried out by a machine (Charles Babbage Analytical Engine).',
      tools: 'Analytical Engine Diagram, Operations Table',
      link: 'https://example.com/note-g',
    },
    {
      id: 'proj-2',
      title: 'Sketch of the Analytical Engine',
      description: 'Translation and extensive annotation of Menabrea paper on mechanical computation.',
      tools: 'Scientific Translation, Analytical Notation',
      link: 'https://example.com/sketch',
    },
  ],
  highlights: [
    'Conceived that computing engines could manipulate symbols and compose music beyond pure arithmetic.',
    'Formulated the first published algorithm intended for implementation on a computer.',
  ],
  activities: [
    'Collaborator with Charles Babbage',
    'Scientific Correspondent, Royal Society Circle',
  ],
  recommendations: [],
  learning: 'Mechanical calculus and future potentials of general-purpose computation engines',
  links: {
    email: 'ada@example.com',
    github: 'https://github.com/adalovelace',
    linkedin: 'https://linkedin.com/in/adalovelace',
    other: [
      { label: 'Analytical Papers', url: 'https://example.com/papers' },
    ],
  },
};

export async function verifyGeneratedProjectBuild() {
  console.log('\n==========================================');
  console.log('CHECKPOINT 8I: Generated Project Build Verification');
  console.log('==========================================\n');

  // 1. Generate project in memory
  const defaultPortfolioConfig = createDefaultPortfolioConfig('advanced');
  if (!defaultPortfolioConfig.advanced) {
    throw new Error('Default advanced portfolio config was not initialized');
  }

  const genResult = generateAdvancedProject({
    profile: sampleProfile,
    config: defaultPortfolioConfig.advanced,
  });

  if (!genResult.ok) {
    throw new Error(`Generation failed: ${genResult.error} (${genResult.code})`);
  }

  const { project } = genResult;
  console.log(`Generated file count: ${project.manifest.generatedFileCount}`);
  console.log(`Enabled pages count: ${project.manifest.enabledPages.length}`);
  console.log(`Routes: ${project.manifest.routes.map((r) => r.route).join(', ')}`);

  // 2. Create isolated temporary directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-8i-build-'));
  console.log(`Target temporary directory: ${tempDir}`);

  try {
    // 3. Write all generated files into temp directory
    for (const file of project.files) {
      const fullPath = path.join(tempDir, file.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content, 'utf-8');
    }
    console.log(`Wrote ${project.files.length} generated files to temporary directory.`);

    // 4. Run npm install inside temp directory
    console.log('Running npm install in temporary directory...');
    const installStart = Date.now();
    execSync('npm install --prefer-offline --no-audit --no-fund', {
      cwd: tempDir,
      stdio: 'pipe',
      timeout: 180000,
    });
    console.log(`npm install completed successfully in ${((Date.now() - installStart) / 1000).toFixed(1)}s.`);

    // 5. Run next build inside temp directory
    console.log('Running npm run build (next build) in temporary directory...');
    const buildStart = Date.now();
    const buildOutput = execSync('npm run build', {
      cwd: tempDir,
      stdio: 'pipe',
      timeout: 180000,
      env: {
        ...process.env,
        CI: '1',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    }).toString();
    console.log(`next build completed successfully in ${((Date.now() - buildStart) / 1000).toFixed(1)}s.`);
    console.log('\n--- Build Output Snippet ---');
    const lines = buildOutput.split('\n').filter((l) => l.trim());
    console.log(lines.slice(-12).join('\n'));

    // Check .next output directory
    const nextDir = path.join(tempDir, '.next');
    if (!fs.existsSync(nextDir)) {
      throw new Error('Build artifact directory .next was not created.');
    }

    const report = {
      ok: true,
      tempDir,
      installResult: 'SUCCESS',
      buildResult: 'SUCCESS',
      generatedPageCount: project.manifest.enabledPages.length,
      generatedRouteCount: project.manifest.routes.length,
      fileCount: project.manifest.generatedFileCount,
    };

    console.log('\n--- Build Verification Report ---');
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    // 6. Clean all temporary artifacts
    console.log('\nCleaning temporary directory...');
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('Temporary directory cleaned successfully.');
    } catch (cleanupErr: any) {
      console.warn('Warning: Failed to clean temp dir immediately:', cleanupErr.message);
    }
  }
}

// Allow direct execution
verifyGeneratedProjectBuild()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Build verification failed:', err);
    process.exit(1);
  });
