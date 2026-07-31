export default function PublicMenuNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
      <h1 className="font-serif text-2xl font-bold mb-2">No menu here.</h1>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        This link isn&apos;t connected to a published menu. Double-check the link, or ask the baker to share it again.
      </p>
    </div>
  );
}
