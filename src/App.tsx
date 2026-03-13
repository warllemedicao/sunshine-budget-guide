import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import AppLockScreen from "@/components/AppLockScreen";
import SplashScreen from "@/components/SplashScreen";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Objetivos = lazy(() => import("@/pages/Objetivos"));
const Graficos = lazy(() => import("@/pages/Graficos"));
const Perfil = lazy(() => import("@/pages/Perfil"));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, locked, unlock } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (locked) return <AppLockScreen userEmail={user.email ?? ""} onUnlock={unlock} />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen">Carregando...</div>}><Dashboard /></Suspense>} />
                <Route path="/objetivos" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen">Carregando...</div>}><Objetivos /></Suspense>} />
                <Route path="/graficos" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen">Carregando...</div>}><Graficos /></Suspense>} />
                <Route path="/perfil" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen">Carregando...</div>}><Perfil /></Suspense>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
