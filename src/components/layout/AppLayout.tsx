import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Search, Film, ShoppingBag, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/explore", icon: Search, label: "Explore" },
  { path: "/reels", icon: Film, label: "Reels" },
  { path: "/shop", icon: ShoppingBag, label: "Shop" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Outlet />

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map((item) => {
          const isActive = item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1 px-3 tap-highlight-none transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.path === "/profile" && profile?.avatar_url ? (
                <div className={cn(
                  "h-6 w-6 rounded-full overflow-hidden border-2 transition-colors",
                  isActive ? "border-foreground" : "border-transparent"
                )}>
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                </div>
              ) : (
                <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 1.5} />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
