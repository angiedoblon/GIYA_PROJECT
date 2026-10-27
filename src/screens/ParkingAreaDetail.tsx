import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ParkingAreaWithStats, ParkingSlot } from '@/types';
import { AvailabilityBar } from '@/components/ui/AvailabilityBar';
import { AvailabilityBadge } from '@/components/ui/AvailabilityBadge';
import { ArrowLeft, MapPin, Camera, Navigation, Building2, Video, VideoOff, Circle, Clock } from 'lucide-react';

interface ParkingAreaDetailProps {
  area: ParkingAreaWithStats;
  onBack: () => void;
}

export function ParkingAreaDetail({ area, onBack }: ParkingAreaDetailProps) {
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    async function loadSlots() {
      const { data } = await supabase
        .from('parking_slots')
        .select('*')
        .eq('area_id', area.id)
        .order('slot_number');

      setSlots(data as ParkingSlot[] ?? []);
      setLoading(false);
    }

    loadSlots();
    const interval = setInterval(loadSlots, 15000);
    return () => clearInterval(interval);
  }, [area.id]);

  const available = slots.filter((s) => s.status === 'available').length;
  const occupied = slots.filter((s) => s.status === 'occupied').length;

  const handleNavigate = () => {
    if (area.latitude && area.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${area.latitude},${area.longitude}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 safe-bottom">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 text-[15px] truncate">{area.name}</h1>
          <div className="flex items-center gap-1">
            <MapPin size={12} className="text-gray-400" />
            <span className="text-xs text-gray-500 truncate">{area.location}</span>
          </div>
        </div>
        <AvailabilityBadge available={available} total={area.total_slots} />
      </header>

      <div className="px-5 py-4 pb-28 space-y-5">
        {/* Camera view */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Camera size={18} className="text-primary-600" />
              <span className="font-semibold text-gray-900 text-sm">Live Camera Feed</span>
            </div>
            <button
              onClick={() => setCameraActive(!cameraActive)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                cameraActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {cameraActive ? 'On' : 'Off'}
            </button>
          </div>
 <div className="relative aspect-video bg-gray-900 overflow-hidden">
  {cameraActive ? (
    <div className="relative w-full h-full bg-black overflow-hidden">

      <iframe
  src="http://localhost:8889/tapo-yolo?autoplay=true&muted=true&controls=true"
  className="absolute inset-0 w-full h-full border-0"
  allow="autoplay; fullscreen"
  title="Tapo C310 Live Camera"
/>

      {/* LIVE indicator */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-md">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-bold text-white">
          LIVE
        </span>
      </div>

    </div>
  ) : (
    <div className="text-center">
      <VideoOff
        size={32}
        className="text-gray-600 mx-auto mb-2"
      />

      <p className="text-gray-500 text-xs">
        Camera feed is off
      </p>

      <p className="text-gray-600 text-[10px] mt-1">
        Tap "On" to view live footage
      </p>
    </div>
  )}
</div>
        </div>

        {/* Stats */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-base">Availability</h2>
            <span className="text-xs text-gray-500 font-medium">{area.total_slots} total slots</span>
          </div>
          <AvailabilityBar available={available} occupied={occupied} total={area.total_slots} />
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-primary-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-extrabold text-primary-700">{available}</div>
              <div className="text-xs font-semibold text-primary-600 mt-0.5">Available</div>
            </div>
            <div className="bg-error-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-extrabold text-error-600">{occupied}</div>
              <div className="text-xs font-semibold text-error-500 mt-0.5">Occupied</div>
            </div>
            <div className="bg-gray-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-extrabold text-gray-600">{area.total_slots}</div>
              <div className="text-xs font-semibold text-gray-500 mt-0.5">Capacity</div>
            </div>
          </div>
        </div>

        {/* Slot grid */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title text-base">Slot Map</h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-primary-500" />
                <span className="text-gray-600 font-medium">Free</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-error-400" />
                <span className="text-gray-600 font-medium">Taken</span>
              </span>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-2">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
                    slot.status === 'available'
                      ? 'bg-primary-100 text-primary-700 border border-primary-200'
                      : 'bg-error-100 text-error-600 border border-error-200'
                  }`}
                  title={`Slot ${slot.slot_number}: ${slot.status}`}
                >
                  {slot.slot_number}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="card p-4 space-y-3">
          <h2 className="section-title text-base">Area Information</h2>
          {area.description && (
            <div className="flex items-start gap-2.5">
              <Circle size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-600">{area.description}</p>
            </div>
          )}
          <div className="flex items-start gap-2.5">
            <Building2 size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-gray-600">Nearest department</p>
              <p className="text-sm font-semibold text-gray-900">{area.department}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-gray-600">Updated</p>
              <p className="text-sm font-semibold text-gray-900">Live (refreshes every 15s)</p>
            </div>
          </div>
        </div>

        {/* Navigate button */}
        <button
          onClick={handleNavigate}
          className="btn-primary w-full flex items-center justify-center gap-2.5 text-base"
        >
          <Navigation size={20} />
          Navigate to this Area
        </button>
      </div>
    </div>
  );
}
