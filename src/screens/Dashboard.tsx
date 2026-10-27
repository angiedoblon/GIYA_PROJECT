import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Vehicle, Violation, ParkingArea, ParkingAreaWithStats } from '@/types';
import { getViolationLabel, getViolationSeverity } from '@/lib/constants';
import { AvailabilityBadge } from '@/components/ui/AvailabilityBadge';
import { Car, Shield, ShieldOff, Bus, Building2, AlertTriangle, BadgeCheck, History } from 'lucide-react';

type DashboardView = 'overview' | 'violations';

interface DashboardProps {
  onNavigateToArea: (area: ParkingAreaWithStats) => void;
}

export function Dashboard({ onNavigateToArea }: DashboardProps) {
  const { user, profile } = useAuth();
  const [view, setView] = useState<DashboardView>('overview');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [areas, setAreas] = useState<ParkingAreaWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [vRes, vioRes, areaRes, slotRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('violations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('parking_areas').select('*').eq('is_active', true).order('code'),
      supabase.from('parking_slots').select('area_id, status'),
    ]);

    setVehicles(vRes.data as Vehicle[] ?? []);
    setViolations(vioRes.data as Violation[] ?? []);

    const slotMap = new Map<string, { available: number; occupied: number }>();
    for (const slot of (slotRes.data as { area_id: string; status: string }[]) ?? []) {
      const entry = slotMap.get(slot.area_id) ?? { available: 0, occupied: 0 };
      if (slot.status === 'available') entry.available++;
      else entry.occupied++;
      slotMap.set(slot.area_id, entry);
    }
    const enriched = ((areaRes.data as ParkingArea[]) ?? []).map((a) => {
      const stats = slotMap.get(a.id) ?? { available: 0, occupied: 0 };
      return { ...a, available_slots: stats.available, occupied_slots: stats.occupied };
    });
    setAreas(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const primaryVehicle = vehicles.find((v) => v.is_primary) ?? vehicles[0];
  const activeViolations = violations.filter((v) => v.status === 'active');

  return (
    <div className="space-y-5 animate-fade-in">
      {/* View tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {([
          { key: 'overview', label: 'Overview' },
          { key: 'violations', label: 'Violations' },
        ] as { key: DashboardView; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              view === tab.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <div className="space-y-4">
          {/* Welcome */}
          <div className="card p-5 bg-gradient-to-br from-primary-600 to-primary-800 text-white border-0">
            <p className="text-primary-100 text-sm">Welcome back,</p>
            <h2 className="text-xl font-extrabold mt-0.5">{profile?.full_name ?? 'Driver'}</h2>
            {profile?.college_department && (
              <div className="flex items-center gap-1.5 mt-2">
                <Building2 size={14} className="text-primary-200" />
                <span className="text-sm text-primary-100">{profile.college_department}</span>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
                  <Car size={18} className="text-primary-600" />
                </div>
                <span className="text-xs font-semibold text-gray-500">Vehicles</span>
              </div>
              <div className="text-2xl font-extrabold text-gray-900">{vehicles.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Registered</div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-9 h-9 bg-error-50 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={18} className="text-error-600" />
                </div>
                <span className="text-xs font-semibold text-gray-500">Violations</span>
              </div>
              <div className="text-2xl font-extrabold text-gray-900">{activeViolations.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Active</div>
            </div>
          </div>

          {/* Primary vehicle — read only, managed by admin */}
          {loading ? (
            <div className="card p-4 animate-pulse"><div className="h-16 bg-gray-100 rounded-xl" /></div>
          ) : primaryVehicle ? (
            <div className="card p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">My Vehicle</h3>
              <VehicleDisplay vehicle={primaryVehicle} />
              {vehicles.length > 1 && (
                <p className="text-xs text-gray-400 mt-2 text-center">+{vehicles.length - 1} more vehicle{vehicles.length - 1 !== 1 ? 's' : ''}</p>
              )}
            </div>
          ) : (
            <div className="card p-5 text-center">
              <Car size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No vehicles registered yet</p>
              <p className="text-xs text-gray-400 mt-1">Contact an administrator to register your vehicle</p>
            </div>
          )}

          {/* Quick parking access */}
          <div>
            <h3 className="section-title text-base mb-3">Quick Parking Access</h3>
            <div className="space-y-2">
              {areas.slice(0, 4).map((area) => (
                <button
                  key={area.id}
                  onClick={() => onNavigateToArea(area)}
                  className="card p-3 w-full text-left flex items-center justify-between transition-all active:scale-[0.99] hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 bg-primary-50 rounded-lg">
                      <span className="text-primary-700 font-bold text-xs">{area.code}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{area.name}</p>
                      <p className="text-xs text-gray-500">{area.available_slots} slots available</p>
                    </div>
                  </div>
                  <AvailabilityBadge available={area.available_slots} total={area.total_slots} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'violations' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-gray-600" />
            <h3 className="section-title text-base">Violation History</h3>
          </div>

          {violations.length === 0 ? (
            <div className="card p-8 text-center">
              <Shield size={36} className="text-primary-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500 mb-1">No violations</p>
              <p className="text-xs text-gray-400">You have a clean parking record</p>
            </div>
          ) : (
            <div className="space-y-3">
              {violations.map((v) => {
                const severity = getViolationSeverity(v.violation_count);
                const styles = {
                  error: 'bg-error-50 border-error-200',
                  warning: 'bg-warning-50 border-warning-200',
                  info: 'bg-accent-50 border-accent-200',
                }[severity];
                const iconColor = {
                  error: 'text-error-600',
                  warning: 'text-warning-600',
                  info: 'text-accent-600',
                }[severity];
                const labelColor = {
                  error: 'text-error-700',
                  warning: 'text-warning-700',
                  info: 'text-accent-700',
                }[severity];

                return (
                  <div key={v.id} className={`card p-4 border-l-4 ${styles}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className={iconColor} />
                        <span className="font-bold text-gray-900 text-sm">{v.violation_type}</span>
                      </div>
                      <span className={`badge ${v.status === 'warning' ? 'bg-warning-100 text-warning-700' : 'bg-error-100 text-error-700'}`}>
                        {getViolationLabel(v.violation_count)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 ml-7">
                      <span className="font-mono font-semibold">{v.plate_number}</span>
                      <span>·</span>
                      <span>{v.area_name ?? 'Unknown area'}</span>
                    </div>
                    {v.description && (
                      <p className="text-xs text-gray-500 ml-7 mt-1.5">{v.description}</p>
                    )}
                    <p className={`text-xs font-semibold mt-2 ml-7 ${labelColor}`}>
                      {new Date(v.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getVehicleTypeIcon(type: string) {
  if (type === 'public') return Bus;
  if (type === 'essu-owned') return Building2;
  return Car;
}

function VehicleDisplay({ vehicle }: { vehicle: Vehicle }) {
  const TypeIcon = getVehicleTypeIcon(vehicle.type);
  return (
    <div className="bg-gray-50 rounded-xl p-3.5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm">
          <TypeIcon size={20} className="text-primary-600" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-gray-900 font-mono">{vehicle.plate_number}</span>
            {vehicle.is_primary && <BadgeCheck size={16} className="text-primary-500" />}
          </div>
          <p className="text-xs text-gray-500">
            {[vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' · ') || 'No details'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className={`badge ${vehicle.registration_status === 'registered' ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>
          {vehicle.registration_status === 'registered' ? <Shield size={12} /> : <ShieldOff size={12} />}
          {vehicle.registration_status === 'registered' ? 'Registered' : 'Unregistered'}
        </span>
      </div>
    </div>
  );
}
