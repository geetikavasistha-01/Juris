import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { DocumentLibraryPage } from './pages/DocumentLibraryPage.js';
import { UploadPage } from './pages/UploadPage.js';
const DocumentViewerPage = React.lazy(() =>
  import('./pages/DocumentViewerPage.js').then((m) => ({ default: m.DocumentViewerPage })),
);
const LiveProgressPage = React.lazy(() =>
  import('./pages/LiveProgressPage.js').then((m) => ({ default: m.LiveProgressPage })),
);
import { AuthPage } from './pages/AuthPage.js';
import { Skeleton } from './components/ui/index.js';

const DesignSystemPage = import.meta.env.DEV
  ? React.lazy(() =>
      import('./pages/DesignSystemPage.js').then((m) => ({ default: m.DesignSystemPage })),
    )
  : null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Main Application Shell with Navbar and Footer */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/documents" replace />} />
              <Route path="/documents" element={<DocumentLibraryPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/documents/:id" element={<DocumentViewerPage />} />
              <Route path="/documents/:id/progress" element={<LiveProgressPage />} />
              <Route path="/login" element={<AuthPage />} />
            </Route>

            {/* Dev-Only Design System Showcase */}
            {import.meta.env.DEV && DesignSystemPage && (
              <Route
                path="/design"
                element={
                  <Suspense
                    fallback={
                      <div className="p-8 max-w-xl mx-auto space-y-4">
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-32 w-full" />
                      </div>
                    }
                  >
                    <DesignSystemPage />
                  </Suspense>
                }
              />
            )}

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/documents" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
