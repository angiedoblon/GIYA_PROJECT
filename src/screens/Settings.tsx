import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { COLLEGE_DEPARTMENTS } from '@/lib/constants';
import type { Vehicle, AppNotification } from '@/types';
import { Logo } from '@/components/ui/Logo';
import { User, Car, Bell, LogOut, ChevronRight, BellOff, BellRing, AlertTriangle, Info, Check, X, Mail, Phone, Building2 } from 'lucide-react';

type SettingsView = 'main' | 'profile' | 'vehicles' | 'notifications';

export function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [view, setView] = useState<SettingsView>('main');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('vehicles').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setVehicles(data as Vehicle[] ?? []));
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setNotifications(data as AppNotification[] ?? []));
  }, [user]);

  if (view === 'profile') {
    return <ProfileSettings onBack={() => setView('main')} onSaved={refreshProfile} />;
  }

  if (view === 'vehicles') {
    return <VehicleSettings vehicles={vehicles} onBack={() => setView('main')} />;
  }

  if (view === 'notifications') {
    return <NotificationSettings onBack={() => setView('main')} />;
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Profile header */}
      <div className="card p-5 bg-gradient-to-br from-primary-600 to-primary-800 text-white border-0">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
            <User size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg truncate">{profile?.full_name ?? 'Driver'}</h2>
            <p className="text-sm text-primary-100 truncate">{user?.email}</p>
            {profile?.college_department && (
              <div className="flex items-center gap-1 mt-1">
                <Building2 size={12} className="text-primary-200" />
                <span className="text-xs text-primary-100">{profile.college_department}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="card divide-y divide-gray-100">
        <SettingsRow
          icon={User}
          iconBg="bg-primary-50 text-primary-600"
          label="Edit Profile"
          subtitle="Name, phone, department"
          onClick={() => setView('profile')}
        />
        <SettingsRow
          icon={Car}
          iconBg="bg-accent-50 text-accent-600"
          label="My Vehicles"
          subtitle={`${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} registered`}
          onClick={() => setView('vehicles')}
        />
        <SettingsRow
          icon={Bell}
          iconBg="bg-warning-50 text-warning-600"
          label="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          badge={unreadCount > 0 ? unreadCount : undefined}
          onClick={() => setView('notifications')}
        />
      </div>

      {/* App info */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <Logo size="sm" />
          <span className="text-xs text-gray-400 font-medium">v1.0.0</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          ESSU Smart Parking Guidance System helps drivers find available parking across campus with real-time slot monitoring and violation tracking.
        </p>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="card w-full p-4 flex items-center justify-center gap-2 text-error-600 font-semibold hover:bg-error-50 transition-colors"
      >
        <LogOut size={18} />
        Sign Out
      </button>
    </div>
  );
}

function SettingsRow({ icon: Icon, iconBg, label, subtitle, onClick, badge }: {
  icon: typeof User;
  iconBg: string;
  label: string;
  subtitle: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3.5 p-4 hover:bg-gray-50 transition-colors text-left">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      {badge !== undefined && (
        <span className="bg-error-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
      <ChevronRight size={18} className="text-gray-300" />
    </button>
  );
}

function ProfileSettings({ onBack, onSaved }: { onBack: () => void; onSaved: () => Promise<void> }) {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [department, setDepartment] = useState(profile?.college_department ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updates: { full_name: string | null; phone: string | null; college_department: string | null } = {
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      college_department: department || null,
    };

    if (profile) {
      await supabase.from('profiles').update(updates).eq('id', user!.id);
    } else {
      await supabase.from('profiles').insert({ id: user!.id, ...updates });
    }
    await onSaved();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          <X size={20} className="text-gray-600" />
        </button>
        <h2 className="section-title">Edit Profile</h2>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label>
          <input type="email" value={user?.email ?? ''} disabled className="input-field bg-gray-100 text-gray-500" />
        </div>
        <div>
          <label className="label">Full Name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="input-field" />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Phone size={14} /> Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912 345 6789" className="input-field" />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Building2 size={14} /> College Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="input-field">
            <option value="">Select department</option>
            {COLLEGE_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        {saved ? <><Check size={18} /> Saved!</> : saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function VehicleSettings({ vehicles, onBack }: { vehicles: Vehicle[]; onBack: () => void }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          <X size={20} className="text-gray-600" />
        </button>
        <h2 className="section-title">My Vehicles</h2>
      </div>

      {vehicles.length === 0 ? (
        <div className="card p-8 text-center">
          <Car size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No vehicles registered</p>
          <p className="text-xs text-gray-400 mt-1">Add vehicles from the Dashboard</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div key={v.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-900 font-mono">{v.plate_number}</span>
                <span className={`badge ${v.registration_status === 'registered' ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>
                  {v.registration_status}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {[v.make, v.model, v.color].filter(Boolean).join(' · ') || 'No details'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="badge bg-accent-100 text-accent-700 capitalize">{v.type.replace('-', ' ')}</span>
                {v.is_primary && <span className="badge bg-primary-100 text-primary-700">Primary</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationSettings({ onBack }: { onBack: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [notifEnabled, setNotifEnabled] = useState(profile?.notification_enabled ?? true);
  const [violationAlerts, setViolationAlerts] = useState(profile?.violation_alerts ?? true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { setNotifications(data as AppNotification[] ?? []); setLoading(false); });
  }, [user]);

  async function toggleNotif(value: boolean) {
    setNotifEnabled(value);
    await supabase.from('profiles').update({ notification_enabled: value }).eq('id', user!.id);
    await refreshProfile();
  }

  async function toggleViolation(value: boolean) {
    setViolationAlerts(value);
    await supabase.from('profiles').update({ violation_alerts: value }).eq('id', user!.id);
    await refreshProfile();
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
            <X size={20} className="text-gray-600" />
          </button>
          <h2 className="section-title">Notifications</h2>
        </div>
        {notifications.some((n) => !n.is_read) && (
          <button onClick={markAllRead} className="text-xs font-semibold text-primary-600">
            Mark all read
          </button>
        )}
      </div>

      {/* Preferences */}
      <div className="card divide-y divide-gray-100">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              {notifEnabled ? <BellRing size={20} className="text-primary-600" /> : <BellOff size={20} className="text-gray-400" />}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">All Notifications</p>
              <p className="text-xs text-gray-500">Receive parking updates</p>
            </div>
          </div>
          <ToggleSwitch checked={notifEnabled} onChange={toggleNotif} />
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-error-50 flex items-center justify-center">
              <AlertTriangle size={20} className="text-error-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Violation Alerts</p>
              <p className="text-xs text-gray-500">Get notified on violations</p>
            </div>
          </div>
          <ToggleSwitch checked={violationAlerts} onChange={toggleViolation} />
        </div>
      </div>

      {/* Recent notifications */}
      <div>
        <h3 className="section-title text-base mb-3">Recent Activity</h3>
        {loading ? (
          <div className="card p-4 animate-pulse"><div className="h-16 bg-gray-100 rounded-xl" /></div>
        ) : notifications.length === 0 ? (
          <div className="card p-8 text-center">
            <Bell size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const Icon = n.type === 'violation' ? AlertTriangle : n.type === 'parking' ? Car : Info;
              const iconColor = n.type === 'violation' ? 'text-error-600 bg-error-50' : n.type === 'parking' ? 'text-primary-600 bg-primary-50' : 'text-accent-600 bg-accent-50';
              return (
                <div key={n.id} className={`card p-3.5 flex items-start gap-3 ${!n.is_read ? 'border-primary-200' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button onClick={() => markAsRead(n.id)} className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0">
                      <Check size={15} className="text-gray-400" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
