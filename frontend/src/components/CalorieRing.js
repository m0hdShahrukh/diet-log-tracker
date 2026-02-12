import '@/App.css';

export default function CalorieRing({ consumed, target, size = 200 }) {
  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min((consumed / target) * 100, 100);
  const offset = circumference - (percent / 100) * circumference;
  const remaining = Math.max(target - consumed, 0);
  const center = size / 2;

  const getColor = () => {
    if (percent >= 100) return '#ef4444';
    if (percent >= 85) return '#f97316';
    return '#88C425';
  };

  return (
    <div className="relative inline-flex items-center justify-center" data-testid="calorie-ring">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="calorie-ring-bg"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="calorie-ring-progress"
          stroke={getColor()}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          {Math.round(remaining)}
        </span>
        <span className="text-xs font-medium text-slate-400 -mt-0.5">cal left</span>
      </div>
    </div>
  );
}
