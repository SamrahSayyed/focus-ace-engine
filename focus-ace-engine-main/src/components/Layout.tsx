import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Brain, LayoutDashboard, Timer, BarChart3, LogOut, Sparkles, CalendarRange, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

const Layout = () => {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState<string>("");
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.display_name ?? user.email?.split("@")[0] ?? "");
        setAvatar(data?.avatar_url ?? null);
      });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    nav("/auth");
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center glow-ring">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">FocusLab</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" end className={linkCls}>
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </NavLink>
            <NavLink to="/tracker" className={linkCls}>
              <Timer className="h-4 w-4" /> Tracker
            </NavLink>
            <NavLink to="/insights" className={linkCls}>
              <Sparkles className="h-4 w-4" /> Insights
            </NavLink>
            <NavLink to="/scheduler" className={linkCls}>
              <CalendarRange className="h-4 w-4" /> Scheduler
            </NavLink>
            <NavLink to="/goals" className={linkCls}>
              <Target className="h-4 w-4" /> Goals
            </NavLink>
            <NavLink to="/analytics" className={linkCls}>
              <BarChart3 className="h-4 w-4" /> Analytics
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-2">
              {avatar ? (
                <img src={avatar} alt={name} className="h-8 w-8 rounded-full object-cover border border-border" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gradient-primary grid place-items-center text-xs font-semibold text-primary-foreground">
                  {name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-sm text-muted-foreground hidden lg:block">{name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* mobile nav */}
        <nav className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          <NavLink to="/" end className={linkCls}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </NavLink>
          <NavLink to="/tracker" className={linkCls}>
            <Timer className="h-4 w-4" /> Tracker
          </NavLink>
          <NavLink to="/insights" className={linkCls}>
            <Sparkles className="h-4 w-4" /> Insights
          </NavLink>
          <NavLink to="/scheduler" className={linkCls}>
            <CalendarRange className="h-4 w-4" /> Scheduler
          </NavLink>
          <NavLink to="/goals" className={linkCls}>
            <Target className="h-4 w-4" /> Goals
          </NavLink>
          <NavLink to="/analytics" className={linkCls}>
            <BarChart3 className="h-4 w-4" /> Analytics
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 container py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        FocusLab — built with care for deep work.
      </footer>
    </div>
  );
};

export default Layout;
