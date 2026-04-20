import { Navbar } from '@/components/store/Navbar';
import { StoreTracker } from '@/components/store/StoreTracker';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <StoreTracker />
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-edge py-8 px-4 text-center">
        <p className="text-sm text-fg-faint">© PixelDropp · The premium digital product marketplace.</p>
      </footer>
    </div>
  );
}
