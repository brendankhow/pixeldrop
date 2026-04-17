import { Navbar } from '@/components/store/Navbar';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-edge py-8 px-4 text-center">
        <p className="text-sm text-fg-faint">© PixelDropp · Built for creators</p>
      </footer>
    </div>
  );
}
