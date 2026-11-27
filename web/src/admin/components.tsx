import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { describeError } from '../api/client';
import { Card, Spinner } from '../components/ui';
import { Page } from '../layout/AppShell';
import { useSignedIn } from '../session/session';

export const SETTINGS = { to: '/settings', label: 'Beállítások' };

/** Admin pages; other keys are sent back to the settings page. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const session = useSignedIn();
  if (session.level !== 'admin') return <Navigate to="/settings" replace />;
  return children;
}

/** A row of the settings menu. */
export function MenuRow({
  to,
  icon: Icon,
  label,
  detail,
  tint,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  detail?: ReactNode;
  tint: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-13 items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-white ${tint}`}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {detail !== undefined && (
        <span className="text-[15px] text-zinc-500">{detail}</span>
      )}
      <ChevronRight className="size-5 text-zinc-400" aria-hidden />
    </Link>
  );
}

/** The loading and error states of an admin page around its content. */
export function Loaded<T>({
  title,
  back = SETTINGS,
  action,
  query,
  children,
}: {
  title: string;
  back?: { to: string; label: string };
  action?: ReactNode;
  query: { isPending: boolean; isError: boolean; error: unknown; data?: T };
  children: (data: T) => ReactNode;
}) {
  return (
    <Page title={title} back={back} action={action}>
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <Card role="alert">{describeError(query.error)}</Card>
      ) : (
        children(query.data as T)
      )}
    </Page>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="py-8 text-center text-[15px] text-zinc-500">
      {children}
    </Card>
  );
}
