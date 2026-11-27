import { Navigate, Route, Routes } from 'react-router';
import { Spinner } from './components/ui';
import { AppShell } from './layout/AppShell';
import { BulbPage } from './pages/BulbPage';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { ScenesPage } from './pages/ScenesPage';
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      );
  }
}
