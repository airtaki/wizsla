import { Navigate, Route, Routes } from 'react-router';
import { AdminOnly } from './admin/components';
import { Spinner } from './components/ui';
import { AppShell } from './layout/AppShell';
import { BulbPage } from './pages/BulbPage';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { ScenesPage } from './pages/ScenesPage';
import { BulbAdminPage } from './pages/admin/BulbAdminPage';
import { BulbsAdminPage } from './pages/admin/BulbsAdminPage';
import { KeysAdminPage } from './pages/admin/KeysAdminPage';
import { LogPage } from './pages/admin/LogPage';
import { RoomsAdminPage } from './pages/admin/RoomsAdminPage';
import { SystemPage } from './pages/admin/SystemPage';
import { SettingsPage } from './pages/SettingsPage';
import { SignInPage } from './pages/SignInPage';
import { UnreachablePage } from './pages/UnreachablePage';
import { useSession } from './session/session';

export function App() {
  const { state } = useSession();

  switch (state.status) {
    case 'loading':
      return <Spinner />;
    case 'signedOut':
      return <SignInPage notice={state.notice} />;
    case 'unreachable':
      return <UnreachablePage error={state.error} />;
    case 'signedIn':
      return (
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/rooms/:slug" element={<RoomPage />} />
            <Route path="/bulbs/:slug" element={<BulbPage />} />
            <Route path="/scenes" element={<ScenesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/*" element={<AdminRoutes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      );
  }
}

function AdminRoutes() {
  return (
    <AdminOnly>
      <Routes>
        <Route path="rooms" element={<RoomsAdminPage />} />
        <Route path="bulbs" element={<BulbsAdminPage />} />
        <Route path="bulbs/:slug" element={<BulbAdminPage />} />
        <Route path="keys" element={<KeysAdminPage />} />
        <Route path="log" element={<LogPage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    </AdminOnly>
  );
}
