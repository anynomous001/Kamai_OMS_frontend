import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Shared shell for /terms and /privacy — public, unauthenticated static
// pages. Styled with the same CSS custom properties (--background,
// --surface, --accent, etc., see globals.css) and font-serif/font-sans
// pairing as the rest of the app, but rendered as plain server components
// (no 'use client', no theme toggle) since these are meant to be linked
// out to — often opened in a fresh tab with no app state to sync against.
export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors"
            aria-label="Back to Kamai"
          >
            <ArrowLeft size={18} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no next/image config needed for a fixed-size logo */}
          <img src="/light-bg-logo.png" alt="Kamai" className="h-7 w-auto object-contain" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 md:py-14">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-2">
          {title}
        </h1>
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-10">
          Last updated: {lastUpdated}
        </p>

        <div className="flex flex-col gap-6 text-[15px] leading-relaxed">{children}</div>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-6 py-8 text-xs text-[var(--text-secondary)] flex flex-col gap-1">
          <p>
            <Link href="/terms" className="text-[var(--accent)] hover:underline font-medium">
              Terms of Service
            </Link>
            {' · '}
            <Link href="/privacy" className="text-[var(--accent)] hover:underline font-medium">
              Privacy Policy
            </Link>
          </p>
          <p>Kamai Technologies</p>
        </div>
      </footer>
    </div>
  );
}

export function LegalH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-xl md:text-2xl font-bold text-[var(--text-primary)] mt-4">
      {children}
    </h2>
  );
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p className="text-[var(--text-secondary)]">{children}</p>;
}

export function LegalUl({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-5 flex flex-col gap-1.5 text-[var(--text-secondary)] marker:text-[var(--accent)]">
      {children}
    </ul>
  );
}

export function LegalHr() {
  return <hr className="border-[var(--border)]" />;
}

export function LegalTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}
