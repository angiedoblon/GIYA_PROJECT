import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/screens/AuthScreen';
import { AppLayout } from '@/components/AppLayout';
import { ParkingGuidance } from '@/screens/ParkingGuidance';
import { ParkingAreaDetail } from '@/screens/ParkingAreaDetail';
import { Dashboard } from '@/screens/Dashboard';
import { AdminDashboard } from '@/screens/AdminDashboard';
import { Settings } from '@/screens/Settings';
import type { TabKey } from '@/lib/tabs';
import type { ParkingAreaWithStats } from '@/types';
import { Logo } from '@/components/ui/Logo';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('guidance');
  const [selectedArea, setSelectedArea] = useState<ParkingAreaWithStats | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Logo size="lg" />
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (selectedArea) {
    return <ParkingAreaDetail area={selectedArea} onBack={() => setSelectedArea(null)} />;
  }

  const headerTitle = {
    guidance: 'Parking Guidance',
    dashboard: 'Dashboard',
    settings: 'Settings',
  }[activeTab];

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab} headerTitle={headerTitle} showLogo={activeTab === 'guidance'}>
      {activeTab === 'guidance' && <ParkingGuidance onSelectArea={setSelectedArea} />}
      {activeTab === 'dashboard' && <Dashboard onNavigateToArea={setSelectedArea} />}
      {activeTab === 'settings' && <Settings />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
