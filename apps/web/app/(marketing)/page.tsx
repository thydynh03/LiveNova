import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Automate TikTok LIVE | The Ultimate Platform',
};

export default function LandingPage() {
  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Hero Section */}
      <section style={{
        padding: '8rem 2rem',
        textAlign: 'center',
        background: 'radial-gradient(circle at top, hsl(var(--primary) / 0.1), transparent 50%)',
      }}>
        <h1 style={{
          fontSize: '4rem',
          fontWeight: 800,
          marginBottom: '1rem',
          lineHeight: 1.1,
        }}>
          Elevate Your <span className="text-gradient">TikTok LIVE</span>
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: 'hsl(var(--muted-foreground))',
          maxWidth: '600px',
          margin: '0 auto 2rem auto',
        }}>
          Engage your audience with premium TTS, interactive overlays, and custom automated rules—all in one place.
        </p>
        <Link href="/dashboard" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
          Get Started
        </Link>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '3rem' }}>Everything you need</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '2rem'
        }}>
          <FeatureCard title="Text-to-Speech (TTS)" desc="Convert viewer comments and gifts to high-quality speech with premium voices." />
          <FeatureCard title="Interactive Overlays" desc="Beautiful widgets for Chat, PK battles, and Goals directly in OBS." />
          <FeatureCard title="Game Integrations" desc="Trigger key presses in your games automatically based on gifts and likes." />
          <FeatureCard title="Advanced Rules" desc="Create precise conditions like 'If Gift = Rose, Play Sound X'." />
        </div>
      </section>

      {/* Social Proof */}
      <section style={{ marginTop: '5rem', padding: '4rem 2rem', background: 'hsl(var(--card))', textAlign: 'center' }}>
        <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Trusted by 10,000+ Creators</h3>
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>Join the fastest growing platform for LIVE streamers.</p>
      </section>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="card glass" style={{
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      cursor: 'default',
    }} onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-5px)';
      e.currentTarget.style.boxShadow = '0 10px 25px -5px rgb(0 0 0 / 0.2)';
    }} onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)';
    }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>{title}</h3>
      <p style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}
