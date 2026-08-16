'use client';

import { ShoppingBasket } from 'lucide-react';

// Placeholder shown in the Marketplace/Supply Hub tab while
// NEXT_PUBLIC_FEATURE_MARKETPLACE is off — see src/app/page.tsx's
// `activeTab === 'supply'` block, which renders this instead of the real
// Supply Hub UI. Styled with the same CSS custom properties
// (--background, --surface, --accent, etc., see globals.css) and
// font-serif/font-sans pairing as the rest of the app.

const CATEGORY_CHIPS = ['Chocolate', 'Cream/Dairy', 'Flour', 'Packaging', 'Tools & Equipment'];

// No shared Kamai business WhatsApp number constant exists anywhere in
// this codebase yet (checked: no env var, no exported constant). Uses
// Kamai's real support WhatsApp number, matching the "Chat with Kamai
// Support" CTA elsewhere in src/app/page.tsx (Help & Support sheet).
const KAMAI_BUSINESS_WHATSAPP_NUMBER = '919874353532';

export function MarketplaceComingSoon() {
  const message = "Hi! I'd like early access to the Wholesale Marketplace on Kamai.";
  const notifyMeLink = `https://wa.me/${KAMAI_BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <div className="w-full animate-fadeIn flex flex-col items-center text-center py-10 px-4">
      <div className="w-20 h-20 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mb-5 shadow-sm">
        <ShoppingBasket size={36} strokeWidth={1.5} className="text-[var(--accent)]" />
      </div>

      <h2 className="font-serif text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
        Wholesale Marketplace — Coming Soon
      </h2>

      <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed mb-6">
        Buy ingredients and packaging straight from verified wholesalers — compare prices, skip the queue, and get
        pre-packed pickups. We&apos;re onboarding suppliers now.
      </p>

      <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-sm">
        {CATEGORY_CHIPS.map((label) => (
          <span
            key={label}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] text-[var(--text-secondary)] opacity-50 cursor-default select-none"
          >
            {label}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => window.open(notifyMeLink, '_blank')}
        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3.5 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer text-sm"
      >
        Notify Me When It&apos;s Live
      </button>
    </div>
  );
}
