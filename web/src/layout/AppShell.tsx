import {
  ChevronLeft,
  House,
  type LucideIcon,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { cn } from '../components/ui';
import { useSignedIn } from '../session/session';
import { LEVEL_LABELS } from '../session/levels';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Otthon', icon: House },
  { to: '/scenes', label: 'Jelenetek', icon: Sparkles },
  { to: '/settings', label: 'Beállítások', icon: Settings },
];

/**
 * Bottom tab bar on phones, sidebar from 1024 px. Leaves room for the notch
 * and the home indicator when the app runs from the home screen.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSignedIn();

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-zinc-200 bg-white px-3 py-6 lg:flex dark:border-zinc-800 dark:bg-zinc-900">
        <p className="px-3 text-lg font-semibold tracking-tight">Wizsla</p>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Fő menü">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium',
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60',
                )
              }
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-3 text-sm text-zinc-500">
          {session.name} · {LEVEL_LABELS[session.level]}
        </p>
      </aside>

      <div className="lg:pl-60">
        <main className="mx-auto max-w-3xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-10 xl:max-w-4xl">
          {children}
        </main>
      </div>

      <nav
        aria-label="Fő menü"
        className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t border-zinc-200 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden dark:border-zinc-800 dark:bg-zinc-900/85"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                isActive
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-zinc-500 dark:text-zinc-400',
              )
            }
          >
            <item.icon className="size-6" aria-hidden />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** A page's title, an optional back link and header action, and content. */
export function Page({
  title,
  back,
  action,
  children,
}: {
  title: string;
  back?: { to: string; label: string };
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {back && (
        <Link
          to={back.to}
          className="-ml-1 mb-1 inline-flex items-center gap-0.5 text-[15px] font-medium text-amber-600 dark:text-amber-400"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="min-w-0 truncate text-[28px] font-bold tracking-tight">
          {title}
        </h1>
        {action}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </>
  );
}
