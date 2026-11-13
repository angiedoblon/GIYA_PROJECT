
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { COLLEGE_DEPARTMENTS } from '@/lib/constants';
import type { ParkingArea, ParkingAreaWithStats } from '@/types';
import { AvailabilityBadge } from '@/components/ui/AvailabilityBadge';
import { AvailabilityBar } from '@/components/ui/AvailabilityBar';
import {
  MapPin,
  ChevronRight,
  Search,
  Building2,
  Car,
  Camera,
} from 'lucide-react';

interface ParkingGuidanceProps {
  onSelectArea: (area: ParkingAreaWithStats) => void;
}

export function ParkingGuidance({ onSelectArea }: ParkingGuidanceProps) {
  const [areas, setAreas] = useState<ParkingAreaWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadAreas() {
      try {
        setError('');

        const { data: areaData, error: areaError } = await supabase
          .from('parking_areas')
          .select('*')
          .eq('is_active', true)
          .order('code');

        if (areaError) throw areaError;

        const { data: slotData, error: slotError } = await supabase
  .from('parking_slots')
  .select('area_id, status');

        if (slotError) throw slotError;

        if (cancelled) return;

        const slotMap = new Map<
          string,
          { available: number; occupied: number }
        >();

        for (const slot of slotData ?? []) {
          const entry = slotMap.get(slot.area_id) ?? {
            available: 0,
            occupied: 0,
          };

          if (slot.status === 'available') {
            entry.available++;
          } else if (slot.status === 'occupied') {
            entry.occupied++;
          }

          slotMap.set(slot.area_id, entry);
        }

        const enriched: ParkingAreaWithStats[] = (
          (areaData ?? []) as ParkingArea[]
        ).map((area) => {
          const stats = slotMap.get(area.id) ?? {
            available: 0,
            occupied: 0,
          };

          return {
            ...area,
            available_slots: stats.available,
            occupied_slots: stats.occupied,
          };
        });

        setAreas(enriched);
      } catch (err) {
        console.error('Failed to load parking guidance:', err);

        if (!cancelled) {
          setError('Unable to load parking information. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAreas();

    const interval = setInterval(loadAreas, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filtered = areas.filter((area) => {
    const matchesDept =
      selectedDept === 'all' || area.department === selectedDept;

    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !query ||
      area.name.toLowerCase().includes(query) ||
      area.code.toLowerCase().includes(query);

    return matchesDept && matchesSearch;
  });

  const totalAvailable = areas.reduce(
    (sum, area) => sum + area.available_slots,
    0
  );

  const totalOccupied = areas.reduce(
    (sum, area) => sum + area.occupied_slots,
    0
  );

  const totalSlots = areas.reduce(
    (sum, area) => sum + area.total_slots,
    0
  );

  const recommendedArea = [...areas]
    .filter((area) => area.available_slots > 0)
    .sort((a, b) => b.available_slots - a.available_slots)[0];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Campus parking statistics */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-5 text-white shadow-lg shadow-primary-600/20">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary-100">
              Campus Parking
            </p>

            <p className="mt-0.5 text-3xl font-extrabold">
              {totalAvailable}{' '}
              <span className="text-lg font-semibold text-primary-200">
                slots free
              </span>
            </p>
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur-sm">
            <Car size={28} strokeWidth={2} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary-300" />
            <span className="text-primary-100">
              {totalAvailable} Available
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="text-primary-100">
              {totalOccupied} Occupied
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
            <span className="text-primary-100">
              {totalSlots} Total
            </span>
          </div>
        </div>
      </div>

      {/* Recommended parking area */}
      {!loading && !error && recommendedArea && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100">
              <Car size={22} className="text-green-700" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                Recommended Parking
              </p>

              <h3 className="mt-1 font-bold text-gray-900">
                {recommendedArea.name}
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                {recommendedArea.available_slots} available out of{' '}
                {recommendedArea.total_slots} slots
              </p>

              <button
                type="button"
                onClick={() => onSelectArea(recommendedArea)}
                className="mt-3 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
              >
                View Parking Area
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search parking area..."
          className="input-field pl-11"
        />
      </div>

      {/* Department filter */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <Building2 size={16} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">
            Filter by Department
          </span>
        </div>

        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedDept('all')}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              selectedDept === 'all'
                ? 'bg-primary-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600'
            }`}
          >
            All Areas
          </button>

          {COLLEGE_DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                selectedDept === dept
                  ? 'bg-primary-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600'
              }`}
            >
              {dept.replace('College of ', '').replace('Administration', 'Admin')}
            </button>
          ))}
        </div>
      </div>

      {/* Parking area cards */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((item) => (
            <div
              key={item}
              className="card animate-pulse p-4"
            >
              <div className="mb-3 h-5 w-3/4 rounded bg-gray-200" />
              <div className="mb-4 h-3 w-1/2 rounded bg-gray-100" />
              <div className="h-2.5 w-full rounded bg-gray-100" />
            </div>
          ))
        ) : error ? (
          <div className="card p-5 text-center">
            <p className="text-sm text-red-600">{error}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Reload Page
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Car size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">
              No parking areas found
            </p>
          </div>
        ) : (
          filtered.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => onSelectArea(area)}
              className="card w-full p-4 text-left transition-all hover:border-primary-200 hover:shadow-md active:scale-[0.99]"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50">
                    <span className="text-sm font-bold text-primary-700">
                      {area.code}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-[15px] font-bold leading-tight text-gray-900">
                      {area.name}
                    </h3>

                    <div className="mt-1 flex items-center gap-1">
                      <MapPin size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {area.location}
                      </span>
                    </div>
                  </div>
                </div>

                <AvailabilityBadge
                  available={area.available_slots}
                  total={area.total_slots}
                />
              </div>

              <div className="mb-3">
                <AvailabilityBar
                  available={area.available_slots}
                  occupied={area.occupied_slots}
                  total={area.total_slots}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary-500" />
                    {area.available_slots} free
                  </span>

                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-error-400" />
                    {area.occupied_slots} taken
                  </span>

                  {area.camera_url && (
                    <span className="flex items-center gap-1 font-medium text-primary-600">
                      <Camera size={12} />
                      Live
                    </span>
                  )}
                </div>

                <ChevronRight size={18} className="shrink-0 text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
