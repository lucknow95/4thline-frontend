'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { name: string; href: string };

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={[
        // Use your global .nav-link skin; active gets the amber glow style
        'nav-link',
        isActive ? 'nav-link-active' : '',
      ].join(' ')}
    >
      {item.name}
    </Link>
  );
}

export default function Navbar() {
  const navItems: NavItem[] = [
    { name: 'Home', href: '/' },
    { name: 'Rankings', href: '/rankings' },
    { name: 'Players', href: '/players' },
    { name: 'Optimizer', href: '/optimizer' },
    { name: 'Crunch Palace', href: '/crunch-palace' },
    { name: 'Blog', href: '/blog' },
    { name: 'Merch', href: '/merch' },          // ← updated label + route
    { name: 'Newsletter', href: '/newsletter' },
    { name: 'Login', href: '/login' },
    { name: 'Settings', href: '/settings' },
  ];

  return (
    <nav className="site-header text-[var(--surface-contrast)]">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-4 py-3">
        <Link
          href="/"
          className="text-xl font-bold tracking-wide hover:text-amber-500 transition"
        >
          4th Line Fantasy
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </div>
    </nav>
  );
}
