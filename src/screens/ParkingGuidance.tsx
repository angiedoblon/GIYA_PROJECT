import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { COLLEGE_DEPARTMENTS } from '@/lib/constants';
import type { ParkingArea, ParkingAreaWithStats } from '@/types';
import { AvailabilityBadge } from '@/components/ui/AvailabilityBadge';
import { AvailabilityBar } from '@/components/ui/AvailabilityBar';
import { MapPin, ChevronRight, Search, Building2, Car, Camera } from 'lucide-react';

interface ParkingGuidanceProps {
  onSelectArea: (area: ParkingAreaWithStats) => void;
}

export function ParkingGuidance({ onSelectArea }: ParkingGuidanceProps) {
  const [areas, setAreas] = useState<ParkingAreaWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadAreas() {
      setLoading(true);
      const { data: areaData } = await supabase
        .from('parking_areas')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (!areaData) { setLoading(false); return; }

      const { data: slotData } = await supabase
        .from('parking_slots')
        .select('area_id, status');

      const slotMap = new Map<string, { available: number; occupied: number }>();
      for (const slot of slotData ?? []) {
        const entry = slotMap.get(slot.area_id) ?? { available: 0, occupied: 0 };
        if (slot.status === 'available') entry.available++;
        else entry.occupied++;
        slotMap.set(slot.area_id, entry);
      }

      const enriched: ParkingAreaWithStats[] = (areaData as ParkingArea[]).map((area) => {
        const stats = slotMap.get(area.id) ?? { available: 0, occupied: 0 };
        return { ...area, available_slots: stats.available, occupied_slots: stats.occupied };
      });

      setAreas(enriched);
      setLoading(false);
    }

    loadAreas();
    const interval = setInterval(loadAreas, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = areas.filter((area) => {
    const matchesDept = selectedDept === 'all' || area.department === selectedDept;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || area.name.toLowerCase().includes(q) || area.code.toLowerCase().includes(q);
    return matchesDept && matchesSearch;
  });

  const totalAvailable = areas.reduce((sum, a) => sum + a.available_slots, 0);
  const totalSlots = areas.reduce((sum, a) => sum + a.total_slots, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Hero stats */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-5 text-white shadow-lg shadow-primary-600/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-primary-100 text-xs font-medium uppercase tracking-wide">Campus Parking</p>
            <p className="text-3xl font-extrabold mt-0.5">{totalAvailable} <span className="text-lg font-semibold text-primary-200">slots free</span></p>
          </div>
          <div className="flex items-center justify-center w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20">
            <Car size={28} strokeWidth={2} />
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-300" />
            <span className="text-primary-100">{totalAvailable} Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-primary-100">{totalSlots - totalAvailable} Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/40" />
            <span className="text-primary-100">{totalSlots} Total</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search parking area..."
          className="input-field pl-11"
        />
      </div>

      {/* Department filter */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Building2 size={16} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filter by Department</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              selectedDept === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            All Areas
          </button>
          {COLLEGE_DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                selectedDept === dept ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {dept.replace('College of ', '').replace('Administration', 'Admin')}
            </button>
          ))}
        </div>
      </div>

      {/* Parking cards */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-5 w-3/4 bg-gray-200 rounded mb-3" />
              <div className="h-3 w-1/2 bg-gray-100 rounded mb-4" />
              <div className="h-2.5 w-full bg-gray-100 rounded" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Car size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No parking areas found</p>
          </div>
        ) : (
          filtered.map((area) => (
            <button
              key={area.id}
              onClick={() => onSelectArea(area)}
              className="card p-4 text-left w-full transition-all active:scale-[0.99] hover:shadow-md hover:border-primary-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-11 h-11 bg-primary-50 rounded-xl">
                    <span className="text-primary-700 font-bold text-sm">{area.code}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-[15px] leading-tight">{area.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-500">{area.location}</span>
                    </div>
                  </div>
                </div>
                <AvailabilityBadge available={area.available_slots} total={area.total_slots} />
              </div>

              <div className="mb-3">
                <AvailabilityBar available={area.available_slots} occupied={area.occupied_slots} total={area.total_slots} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    {area.available_slots} free
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-error-400" />
                    {area.occupied_slots} taken
                  </span>
                  {area.camera_url && (
                    <span className="flex items-center gap-1 text-primary-600 font-medium">
                      <Camera size={12} />
                      Live
                    </span>
                  )}
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
