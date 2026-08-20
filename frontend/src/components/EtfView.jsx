import { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

export default function EtfView() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState(20);
  const [monthlyRate, setMonthlyRate] = useState(0.005);

  useEffect(() => {
    api.etfPlan().then(j => { setPlan(j); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-slate-500 text-sm">Caricamento piano ETF...</div>;
  if (!plan) return <div className="text-center py-20 text-slate-500 text-sm">Nessun dato disponibile</div>;

  const monthly = plan.recommended_monthly || 0;
  const years = plan.years_invested || 0;
  const totalInvested = plan.total_invested || 0;
  const currentValue = plan.current_value || 0;
  const returns = currentValue - totalInvested;

  const projections = [];
  let balance = currentValue;
  for (let y = 0; y <= horizon; y++) {
    projections.push({ year: `Anno ${y}`, valore: balance, versato: totalInvested + monthly * 12 * y });
    balance = (balance + monthly * 12) * (1 + monthlyRate * 12);
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-4">Piano ETF attuale</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Consigliato al mese</p>
            <p className="text-2xl font-black text-violet-300">{fmt(monthly)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Anni di investimento</p>
            <p className="text-2xl font-black text-slate-200">{years.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Totale investito</p>
            <p className="text-lg font-black text-slate-300">{fmt(totalInvested)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Valore attuale</p>
            <p className={`text-lg font-black ${returns >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmt(currentValue)}</p>
          </div>
        </div>
        {returns !== 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Rendimento totale</span>
              <span className={`text-sm font-bold ${returns >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {returns >= 0 ? '+' : ''}{fmt(returns)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Proiezione future</h3>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">Orizzonte (anni)</label>
            <input type="range" min={1} max={40} value={horizon} onChange={e => setHorizon(+e.target.value)} className="w-full accent-violet-500" />
            <span className="text-xs text-slate-400 font-mono">{horizon} anni</span>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">Rendimento annuo</label>
            <input type="range" min={0} max={0.15} step={0.001} value={monthlyRate} onChange={e => setMonthlyRate(+e.target.value)} className="w-full accent-violet-500" />
            <span className="text-xs text-slate-400 font-mono">{pct(monthlyRate * 12)}/anno</span>
          </div>
        </div>
        <div className="space-y-2">
          {projections.filter((_, i) => i % Math.max(1, Math.floor(horizon / 8)) === 0 || i === projections.length - 1).map(p => (
            <div key={p.year} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5">
              <span className="text-sm text-slate-400">{p.year}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500">Versato: {fmt(p.versato)}</span>
                <span className="text-sm font-bold text-violet-300 font-mono">{fmt(p.valore)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
