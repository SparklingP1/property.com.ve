import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  changePct?: number | null;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, sublabel, changePct, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <h3 className="font-semibold text-stone-600 text-sm uppercase tracking-wide">{label}</h3>
      </div>
      <p className="text-3xl font-bold text-stone-900">{value}</p>
      <div className="flex items-center gap-2 mt-2">
        {changePct !== null && changePct !== undefined && (
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${
            changePct > 0 ? 'text-green-600' : changePct < 0 ? 'text-red-600' : 'text-stone-500'
          }`}>
            {changePct > 0 ? <TrendingUp className="h-4 w-4" /> :
             changePct < 0 ? <TrendingDown className="h-4 w-4" /> :
             <Minus className="h-4 w-4" />}
            {changePct > 0 ? '+' : ''}{changePct}%
          </span>
        )}
        {sublabel && <span className="text-sm text-stone-500">{sublabel}</span>}
      </div>
    </div>
  );
}
