import { Compass, LayoutGrid, Settings, type LucideIcon } from 'lucide-react';

export type TabKey = 'guidance' | 'dashboard' | 'settings';

export interface TabConfig {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

export const TABS: TabConfig[] = [
  { key: 'guidance', label: 'Parking', icon: Compass },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { key: 'settings', label: 'Settings', icon: Settings },
];
