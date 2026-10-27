interface AvailabilityBarProps {
  available: number;
  occupied: number;
  total: number;
}

export function AvailabilityBar({ available, occupied, total }: AvailabilityBarProps) {
  const availablePct = total > 0 ? (available / total) * 100 : 0;
  const occupiedPct = total > 0 ? (occupied / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-500">Capacity</span>
        <span className="text-xs font-bold text-gray-700">{available}/{total} free</span>
      </div>
      <div className="h-2.5 w-full bg-gray-200 rounded-full overflow-hidden flex">
        <div className="bg-primary-500 h-full transition-all duration-500" style={{ width: `${availablePct}%` }} />
        <div className="bg-error-400 h-full transition-all duration-500" style={{ width: `${occupiedPct}%` }} />
      </div>
    </div>
  );
}
