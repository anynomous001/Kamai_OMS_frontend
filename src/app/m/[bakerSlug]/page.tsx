import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Server Component, no client JS shipped for this route beyond what Next
// itself needs — this page must load fast on mobile networks with no
// unnecessary client-side dependencies. Fetched server-side with zero auth
// headers/cookies, matching the public, unauthenticated nature of the API
// route it calls.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://kamai-backend-6n6v.onrender.com';

const MENU_ITEM_UNIT_LABELS: Record<string, string> = {
  per_kg: 'per kg',
  per_piece: 'per piece',
  per_box: 'per box',
  per_dozen: 'per dozen',
};

interface PublicMenuItem {
  name: string;
  category: string | null;
  price: number;
  unit: string;
  description: string | null;
  photoUrl: string | null;
}

interface PublicMenuData {
  businessName: string | null;
  logoUrl: string | null;
  whatsappNumber: string | null;
  items: PublicMenuItem[];
}

async function getPublicMenu(bakerSlug: string): Promise<PublicMenuData | null> {
  const res = await fetch(`${API_BASE_URL}/api/public/menu/${encodeURIComponent(bakerSlug)}`, {
    // No credentials, no auth headers — this is the one unauthenticated
    // route in the app. cache: 'no-store' since a baker's menu (prices,
    // availability) can change at any time and this page has no chrome
    // to trigger a manual refresh.
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load menu');

  const body = await res.json();
  return body.data as PublicMenuData;
}

// Same wa.me deep-link construction already used throughout the app
// (see src/app/page.tsx) — bare digits, no reinvented normalization.
function buildWhatsAppOrderLink(whatsappNumber: string, itemName: string): string {
  const digits = whatsappNumber.replace(/\D/g, '');
  const text = `Hi, I'd like to order ${itemName} from your menu.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bakerSlug: string }>;
}): Promise<Metadata> {
  const { bakerSlug } = await params;
  const menu = await getPublicMenu(bakerSlug).catch(() => null);

  if (!menu) {
    return { title: 'Menu not found | Kamai' };
  }

  const title = `${menu.businessName || 'Menu'} | Kamai`;
  const description = `View the menu${menu.businessName ? ` for ${menu.businessName}` : ''} and order directly on WhatsApp.`;

  return {
    title,
    description,
    openGraph: { title, description, images: menu.logoUrl ? [menu.logoUrl] : undefined },
  };
}

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ bakerSlug: string }>;
}) {
  const { bakerSlug } = await params;
  const menu = await getPublicMenu(bakerSlug);

  if (!menu) {
    notFound();
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
      <div className="max-w-xl mx-auto px-5 py-10 flex flex-col gap-8">

        {/* Business header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-20 h-20 rounded-full overflow-hidden border flex items-center justify-center text-2xl font-bold" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            {menu.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={menu.logoUrl} alt={menu.businessName || 'Bakery logo'} className="w-full h-full object-cover" />
            ) : (
              (menu.businessName || '?').charAt(0)
            )}
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold">{menu.businessName || 'Menu'}</h1>
        </div>

        {/* Items */}
        {menu.items.length === 0 ? (
          <p className="text-xs text-center py-10" style={{ color: 'var(--text-secondary)' }}>
            No items available right now — check back soon.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {menu.items.map((item, i) => (
              <div
                key={`${item.name}-${i}`}
                className="p-4 rounded-[22px] border shadow-sm flex gap-3.5"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="w-16 h-16 shrink-0 rounded-2xl overflow-hidden border flex items-center justify-center" style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : null}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm">{item.name}</h3>
                    <span className="font-extrabold text-sm shrink-0" style={{ color: 'var(--accent)' }}>
                      ₹{item.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {MENU_ITEM_UNIT_LABELS[item.unit] || item.unit}
                  </p>
                  {item.category && (
                    <span
                      className="inline-flex text-[9px] font-extrabold px-2.5 py-0.5 rounded-full mt-1.5 uppercase tracking-wide border"
                      style={{ color: 'var(--text-secondary)', background: 'var(--background)', borderColor: 'var(--border)' }}
                    >
                      {item.category}
                    </span>
                  )}
                  {item.description && (
                    <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {item.description}
                    </p>
                  )}

                  {menu.whatsappNumber && (
                    <a
                      href={buildWhatsAppOrderLink(menu.whatsappNumber, item.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2.5 text-white text-[11px] font-bold px-3.5 py-2 rounded-xl transition-all"
                      style={{ background: 'var(--accent)' }}
                    >
                      Message on WhatsApp to Order
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-[10px] mt-4" style={{ color: 'var(--text-secondary)' }}>
          Powered by{' '}
          <a href="https://app.getkamai.online" className="font-bold" style={{ color: 'var(--accent)' }}>
            Kamai
          </a>
        </p>
      </div>
    </div>
  );
}
