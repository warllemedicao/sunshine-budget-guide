import { Home, Target, PieChart, User, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onAddClick: () => void;
}

const tabs = [
  { path: "/", icon: Home, label: "Início" },
  { path: "/objetivos", icon: Target, label: "Objetivos" },
  { path: "/graficos", icon: PieChart, label: "Gráficos" },
  { path: "/perfil", icon: User, label: "Perfil" },
];

const BottomNav = ({ onAddClick }: BottomNavProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-bottom md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1">
          {tabs.slice(0, 2).map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-label={tab.label}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <button
            onClick={onAddClick}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg -mt-5 transition-transform active:scale-95"
            aria-label="Adicionar lançamento"
          >
            <Plus className="h-6 w-6" />
          </button>

          {tabs.slice(2).map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-label={tab.label}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-16 flex-col items-center border-r border-border bg-card/95 backdrop-blur-md py-4">
        <div className="flex flex-col gap-2">
          {tabs.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                )}
                aria-label={tab.label}
              >
                <tab.icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
        <div className="mt-auto">
          <button
            onClick={onAddClick}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
            aria-label="Adicionar lançamento"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
