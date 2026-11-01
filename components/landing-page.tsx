import { useEffect, useRef } from 'react';
import { Icon } from '@/components/icon';

import type { User } from '@supabase/supabase-js';

type LandingPageProps = {
  hasDraft: boolean;
  user?: User | null;
  onStart: () => void;
  onResume: () => void;
  onLogin: () => void;
};

export function LandingPage({ hasDraft, user, onStart, onResume, onLogin }: LandingPageProps) {
  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const landing = landingRef.current;
    if (!landing) return;

    const targets = [...landing.querySelectorAll<HTMLElement>('[data-reveal]')];
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      landing.dataset.motionReady = 'true';
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    targets.forEach((target) => {
      const bounds = target.getBoundingClientRect();
      if (bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0) {
        target.classList.add('is-visible');
      } else {
        observer.observe(target);
      }
    });
    landing.dataset.motionReady = 'true';

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing screen-fade" ref={landingRef}>
      <header className="topbar">
        <a className="logo" href="#top" aria-label="folio home"><span className="logo-mark"><Icon name="leaf" size={15} /></span><span>folio</span></a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#how">How it works</a><a href="#what-counts">What counts?</a><a href="#designs">Designs</a><a href="/template-demos">Style showcase</a>
        </nav>
        <div className="nav-actions">
          <a href="/account" className="text-button account-link" aria-label="Account">Account</a>
          {hasDraft ? (
            <button className="text-button resume-draft-link" onClick={onResume} aria-label="Continue draft">
              Continue draft
            </button>
          ) : !user ? (
            <button className="text-button" onClick={onLogin} aria-label="Log in">
              Log in
            </button>
          ) : null}
          <button className="button small" onClick={onStart}>Create my portfolio <Icon name="arrow" size={13} /></button>
        </div>
      </header>
      <main id="top">
        <section className="hero-wrap">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="hero-kicker"><span className="kicker-dot" /> Your first portfolio, made simple</div>
              <h1>Tell us about yourself. We’ll turn it into a professional <em>portfolio.</em></h1>
              <p>Turn class assignments, small builds, and the things you’re learning into a polished link. No code. No perfect-project requirement.</p>
              <div className="hero-actions">
                <button className="button" onClick={onStart}>Create my portfolio <Icon name="arrow" size={15} /></button>
                <a className="button secondary" href="#how">See how it works</a>
              </div>
              <div className="hero-note"><Icon name="lock" size={13} /> Free to start <span>·</span> About 5 minutes <span>·</span> You stay in control</div>
            </div>
            <div className="hero-art" aria-label="Example portfolio preview">
              <div className="art-wash" />
              <div className="folio-sample">
                <div className="sample-browser"><span className="browser-dot" /><span className="browser-dot" /><span className="browser-dot" /><span className="sample-url">maya.folio.site</span></div>
                <div className="sample-page">
                  <div className="sample-topline"><span>PORTFOLIO · 2026</span><span className="sample-availability"><i /> Open to opportunities</span></div>
                  <div className="sample-hero">
                    <div><div className="eyebrow">A little about me</div><h2>Maya<br />Raman</h2><p>First-year engineering student curious about thoughtful technology.</p><div className="sample-facts"><span>Bengaluru</span><span>Learning by building</span></div></div>
                    <div className="sample-avatar">MR</div>
                  </div>
                  <div className="sample-rule">
                    <div><h3>Currently exploring</h3><p>Web development · Python · Accessible design</p></div>
                    <div className="sample-project"><small>A small project</small><strong>Campus Question Box</strong></div>
                  </div>
                </div>
              </div>
              <div className="float-note note-one"><span className="float-icon"><Icon name="spark" size={14} /></span><span><strong>Small things count</strong>Start with what you’ve done.</span></div>
              <div className="float-note note-two"><span className="float-icon"><Icon name="eye" size={14} /></span><span><strong>See it as you build</strong>Your preview updates live.</span></div>
            </div>
          </div>
          <div className="hero-bottom" data-reveal="">
            <div className="social-proof"><div className="mini-avatars"><span>A</span><span>J</span><span>M</span></div><p><strong>Made for first-timers</strong><br />Students, freshers, and curious people</p></div>
            <div className="tag-line">No coding or design experience needed</div>
          </div>
        </section>
        <section className="section-pad how-section" id="how" data-reveal="">
          <div className="section-inner">
            <div className="section-heading" data-reveal=""><span className="eyebrow">A calmer way to get started</span><h2>From rough notes to a link you’re proud to share.</h2><p>You don’t need to know what a portfolio “should” look like. We’ll help you work it out one small step at a time.</p></div>
            <div className="steps-grid">
              <article className="landing-step" data-reveal=""><div className="step-number">01</div><h3>Tell us what you’ve done</h3><p>Answer a few simple questions about what you’re learning, making, or helping with.</p></article>
              <article className="landing-step" data-reveal=""><div className="step-number">02</div><h3>Make it sound like you</h3><p>Review what you shared, decide what to keep, and edit everything in your own words.</p></article>
              <article className="landing-step" data-reveal=""><div className="step-number">03</div><h3>Choose a look and share</h3><p>See your site as it takes shape, pick a design, and get a link when you’re ready.</p></article>
            </div>
          </div>
        </section>
        <section className="section-pad" id="what-counts" data-reveal="">
          <div className="section-inner count-section">
            <div className="section-heading" data-reveal=""><span className="eyebrow">You have more to show than you think</span><h2>No “big project” required.</h2><p>A first portfolio is a starting point, not a test of how much experience you already have.</p></div>
            <div className="count-cards">
              <article className="count-card" data-reveal=""><span className="count-icon">✳</span><h3>Classwork &amp; experiments</h3><p>A small assignment, Python program, or idea you tried while learning.</p></article>
              <article className="count-card" data-reveal=""><span className="count-icon">⌘</span><h3>Things you helped make happen</h3><p>Organizing an event, volunteering, or helping a team solve a problem.</p></article>
              <article className="count-card" data-reveal=""><span className="count-icon">◌</span><h3>Designs &amp; prototypes</h3><p>A Figma exploration, sketch, app idea, or hackathon prototype.</p></article>
              <article className="count-card" data-reveal=""><span className="count-icon">↗</span><h3>What you’re learning now</h3><p>Show the direction you’re exploring—even while you’re still a beginner.</p></article>
            </div>
          </div>
        </section>
        <section className="section-pad design-section" id="designs" data-reveal="">
          <div className="section-inner">
            <div className="section-heading" data-reveal=""><span className="eyebrow">Three different starting points</span><h2>A design that feels like you.</h2><p>Not just new colors. Pick a layout that suits the story you want to tell.</p></div>
            <div className="design-grid">
              <article className="design-card" data-reveal=""><div className="mini-site minimal"><div className="mini-eyebrow">A little about me</div><h4>Alex Morgan</h4><p>Curious about making everyday tools easier to use.</p></div><div className="design-card-bottom"><strong>Quiet &amp; minimal</strong><span>For a clean first impression</span></div></article>
              <article className="design-card" data-reveal=""><div className="mini-site editorial"><div className="mini-eyebrow">Notes from the journey</div><h4>Alex<br />Morgan</h4><p>Learning out loud, one small idea at a time.</p></div><div className="design-card-bottom"><strong>Story-led</strong><span>For a more personal feel</span></div></article>
              <article className="design-card" data-reveal=""><div className="mini-site project"><div className="mini-eyebrow">Selected work</div><h4>Alex Morgan</h4><p>Small builds. Useful questions. Room to grow.</p></div><div className="design-card-bottom"><strong>Project-forward</strong><span>For work that leads the way</span></div></article>
            </div>
            <div className="explore-more-demos"><span>Want to see other visual directions?</span><a className="button secondary small" href="/template-demos">Compare all 22 styles <Icon name="arrow" size={12} /></a></div>
          </div>
        </section>
        <section className="final-cta" data-reveal=""><span className="eyebrow">Your next step can be small</span><h2>Start with what you have.</h2><p>Make a first version today. You can always add more as you learn and build.</p><button className="button light" onClick={onStart}>Create my portfolio <Icon name="arrow" size={14} /></button></section>
      </main>
      <footer className="footer">
        <a className="logo" href="#top" aria-label="folio home">
          <span className="logo-mark"><Icon name="leaf" size={12} /></span>
          <span>folio</span>
        </a>
        <span>A first portfolio, for wherever you’re starting.</span>
        <div style={{ display: 'inline-flex', gap: '16px', alignItems: 'center' }}>
          <a href="/account" aria-label="Account">Account</a>
          <a href="/template-demos">Style showcase</a>
          <a href="https://github.com/VarshuDev" target="_blank" rel="noopener noreferrer">Built by VarshuDev</a>
        </div>
      </footer>
    </div>
  );
}
