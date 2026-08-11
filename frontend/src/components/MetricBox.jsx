export default function MetricBox({ label, value, color, active, onClick }) {
  return (
    <div onClick={onClick}
      className={`rounded-2xl p-3.5 cursor-pointer transition-all active:scale-[0.97] border ${
        active ? 'border-cyan-500/50 bg-cyan-500/5 shadow-lg shadow-cyan-500/5' : 'border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-900/40'
      }`}>
      <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-black mt-0.5 ${color}`}>{value.toFixed(2)}</p>
      <p className="text-[8px] text-slate-600">EUR</p>
    </div>
  );
}
