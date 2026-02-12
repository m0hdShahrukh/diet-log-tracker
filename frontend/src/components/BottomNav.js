import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Plus, TrendingUp, Settings } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { icon: Home, label: 'Home', to: '/' },
    { icon: Plus, label: 'Add', to: '/add-food', center: true },
    { icon: TrendingUp, label: 'Progress', to: '/progress' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-5 left-4 right-4 h-16 bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.1)] flex items-center justify-around z-40 max-w-md mx-auto"
    >
      {tabs.map((t) => {
        const active = t.to === '/' ? path === '/' : path.startsWith(t.to);
        if (t.center) {
          return (
            <button
              key={t.label}
              data-testid="nav-add-food"
              onClick={() => navigate(t.to)}
              className="w-14 h-14 -mt-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform"
            >
              <Plus className="w-7 h-7" />
            </button>
          );
        }
        return (
          <button
            key={t.label}
            data-testid={`nav-${t.label.toLowerCase()}`}
            onClick={() => navigate(t.to)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 transition-colors ${
              active ? 'text-[#88C425]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <t.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
