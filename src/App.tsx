import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import AuthPage from "@/pages/AuthPage";
import HomeFeed from "@/pages/HomeFeed";
import ExplorePage from "@/pages/ExplorePage";
import ReelsPage from "@/pages/ReelsPage";
import ShopPage from "@/pages/ShopPage";
import ProfilePage from "@/pages/ProfilePage";
import EditProfilePage from "@/pages/EditProfilePage";
import CreatePostPage from "@/pages/CreatePostPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<HomeFeed />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/reels" element={<ReelsPage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/user/:username" element={<ProfilePage />} />
            </Route>
            <Route path="/create" element={<ProtectedRoute><CreatePostPage /></ProtectedRoute>} />
            <Route path="/edit-profile" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
