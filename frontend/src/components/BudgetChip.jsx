export default function BudgetChip({ label, value, color, bg }) {
  return (
    <div className={`${bg} border border-slate-800/30 rounded-xl p-2.5`}>
      <p className="text-[7px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}
