export default function SummaryCard({ label, value, pct, color }) {
  const colors = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', bar: 'bg-emerald-500', border: 'border-emerald-500/20' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-300', bar: 'bg-rose-500', border: 'border-rose-500/20' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-300', bar: 'bg-teal-500', border: 'border-teal-500/20' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-300', bar: 'bg-violet-500', border: 'border-violet-500/20' },
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-300', bar: 'bg-slate-500', border: 'border-slate-500/20' },
  };
  const s = colors[color] || colors.slate;
  return (
    <div className={`${s.bg} ${s.border} border rounded-2xl p-3`}>
      <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-black mt-0.5 ${s.text}`}>{value.toFixed(2)} €</p>
      <div className="mt-1.5 w-full h-1 bg-slate-800/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
      </div>
    </div>
  );
}
