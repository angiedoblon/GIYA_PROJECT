import { TABS, type TabKey } from '@/lib/tabs';
import { Logo } from '@/components/ui/Logo';

interface AppLayoutProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: React.ReactNode;
  headerTitle: string;
  showLogo?: boolean;
}

export function AppLayout({ activeTab, onTabChange, children, headerTitle, showLogo }: AppLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col mx-auto lg:max-w-[1440px] lg:shadow-xl lg:shadow-gray-200/50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-gray-100 px-5 py-3.5 safe-bottom">
        <div className="flex items-center justify-between">
          {showLogo ? (
            <Logo size="sm" />
          ) : (
            <h1 className="text-lg font-bold text-gray-900">{headerTitle}</h1>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-soft" />
            <span className="text-xs font-semibold text-primary-600">Live</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 py-4 pb-28 lg:px-10 lg:py-8">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full lg:max-w-[1440px] bg-white border-t border-gray-100 z-30 safe-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all ${
                  isActive ? 'text-primary-600' : 'text-gray-400'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-primary-50' : ''}`}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[11px] font-semibold ${isActive ? 'text-primary-600' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
