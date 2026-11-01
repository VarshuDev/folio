import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { PortfolioRenderer } from '../../components/portfolio-renderer';
import { STYLE_AUDIT_FIXTURES } from '../../lib/style-audit-fixtures';
import {
  createDefaultDesign,
  createEmptyProfile,
  TEMPLATE_IDS,
  type DesignConfig,
  type TemplateId,
} from '../../lib/profile-schema';

test('all 22 portfolio styles render without throwing across standard profile fixtures', () => {
  assert.equal(TEMPLATE_IDS.length, 22);

  for (const templateId of TEMPLATE_IDS) {
    const design: DesignConfig = {
      ...createDefaultDesign(),
      templateId,
    };

    for (const fixture of STYLE_AUDIT_FIXTURES) {
      assert.doesNotThrow(() => {
        const html = renderToStaticMarkup(
          React.createElement(PortfolioRenderer, {
            profile: fixture.profile,
            design,
          })
        );
        assert.ok(html.length > 50, `Rendered HTML for style ${templateId} on fixture ${fixture.id} was empty`);
        assert.ok(
          html.includes(fixture.profile.basics.name) || html.includes(fixture.profile.basics.name.split(' ')[0]),
          `Expected rendered HTML to include name "${fixture.profile.basics.name}" for style ${templateId}`
        );
      }, `Style "${templateId}" crashed on fixture "${fixture.id}"`);
    }
  }
});

test('public renderer degrades gracefully with completely empty profile', () => {
  const emptyProfile = createEmptyProfile();
  emptyProfile.basics.name = 'Anonymous Tester';

  for (const templateId of TEMPLATE_IDS) {
    const design: DesignConfig = {
      ...createDefaultDesign(),
      templateId,
    };

    assert.doesNotThrow(() => {
      const html = renderToStaticMarkup(
        React.createElement(PortfolioRenderer, {
          profile: emptyProfile,
          design,
        })
      );
      assert.ok(html.length > 30);
      assert.ok(html.includes('Anonymous Tester'));
    }, `Style ${templateId} crashed on empty profile`);
  }
});

test('public renderer respects section visibility toggles', () => {
  const fixture = STYLE_AUDIT_FIXTURES[1]; // dense fixture
  const design: DesignConfig = {
    ...createDefaultDesign(),
    templateId: 'minimal',
    visibleSections: {
      about: true,
      education: false, // hidden
      skills: true,
      projects: true,
      highlights: false, // hidden
      contact: true,
    },
  };

  const html = renderToStaticMarkup(
    React.createElement(PortfolioRenderer, {
      profile: fixture.profile,
      design,
    })
  );

  // Hidden section anchors should not exist
  assert.ok(!html.includes('portfolio-minimal-section-education'));
  assert.ok(!html.includes('portfolio-minimal-section-highlights'));

  // Visible section anchors should exist
  assert.ok(html.includes('portfolio-minimal-section-about'));
  assert.ok(html.includes('portfolio-minimal-section-skills'));
  assert.ok(html.includes('portfolio-minimal-section-projects'));
});

test('public renderer respects custom section order', () => {
  const fixture = STYLE_AUDIT_FIXTURES[2]; // rich fixture with links, projects, skills
  const design: DesignConfig = {
    ...createDefaultDesign(),
    templateId: 'minimal',
    sectionOrder: ['contact', 'projects', 'skills', 'about', 'education', 'highlights'],
  };

  const html = renderToStaticMarkup(
    React.createElement(PortfolioRenderer, {
      profile: fixture.profile,
      design,
    })
  );

  const contactIndex = html.indexOf('portfolio-minimal-section-contact');
  const projectsIndex = html.indexOf('portfolio-minimal-section-projects');
  const skillsIndex = html.indexOf('portfolio-minimal-section-skills');

  assert.ok(contactIndex !== -1, 'contact section should be rendered');
  assert.ok(projectsIndex !== -1, 'projects section should be rendered');
  assert.ok(skillsIndex !== -1, 'skills section should be rendered');

  assert.ok(contactIndex < projectsIndex, 'contact section should appear before projects');
  assert.ok(projectsIndex < skillsIndex, 'projects section should appear before skills');
});
