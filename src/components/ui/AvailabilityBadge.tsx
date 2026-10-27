import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface AvailabilityBadgeProps {
  available: number;
  total: number;
}

export function AvailabilityBadge({ available, total }: AvailabilityBadgeProps) {
  let config: { bg: string; text: string; label: string; Icon: typeof CheckCircle2 };
  const isFull = available === 0;
  const isLow = available > 0 && available <= Math.ceil(total * 0.15);

  if (isFull) {
    config = { bg: 'bg-error-100', text: 'text-error-700', label: 'Full', Icon: XCircle };
  } else if (isLow) {
    config = { bg: 'bg-warning-100', text: 'text-warning-700', label: 'Low', Icon: AlertCircle };
  } else {
    config = { bg: 'bg-primary-100', text: 'text-primary-700', label: 'Available', Icon: CheckCircle2 };
  }

  const { bg, text, label, Icon } = config;

  return (
    <span className={`badge ${bg} ${text}`}>
      <Icon size={13} strokeWidth={2.5} />
      {label}
    </span>
  );
}
