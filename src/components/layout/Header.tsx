import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-4 lg:px-8">
      <h1 className="text-lg font-bold tracking-tight lg:hidden">Waypoint</h1>
      <div className="hidden lg:block" />
      <ThemeToggle />
    </header>
  );
}
