export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = {
    sm: { box: 'w-9 h-9', text: 'text-base' },
    md: { box: 'w-11 h-11', text: 'text-lg' },
    lg: { box: 'w-16 h-16', text: 'text-2xl' },
  }[size];

  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/public/giyalogo.png"
        alt="ESSU Smart Parking"
        className={`${dims.box} rounded-xl object-cover shadow-md shadow-primary-600/20`}
      />
      <div className="leading-tight">
        <div className={`${dims.text} font-extrabold text-gray-900 tracking-tight`}>ESSU</div>
        <div className="text-[10px] font-semibold text-primary-600 uppercase tracking-wider">Smart Parking</div>
      </div>
    </div>
  );
}
