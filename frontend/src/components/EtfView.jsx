import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { monthLabel } from '../constants';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

export default function EtfView() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [horizon, setHorizon] = useState(20);
  const [annualReturn, setAnnualReturn] = useState(0.06);

  useEffect(() => {
    let active = true;
    api.etfPlan()
      .then((payload) => { if (active) setPlan(payload); })
      .catch((exc) => { if (active) setError(exc.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const projections = useMemo(() => {
    if (!plan) return [];
    const monthly = plan.recommended_monthly || 0;
    const monthlyRate = annualReturn / 12;
    const rows = [];
    let balance = 0;
    for (let year = 0; year <= horizon; year += 1) {
      if (year > 0) {
        for (let month = 0; month < 12; month += 1) {
          balance = (balance + monthly) * (1 + monthlyRate);
        }
      }
      rows.push({ year, value: balance, contributed: monthly * 12 * year });
    }
    return rows;
  }, [plan, horizon, annualReturn]);

  if (loading) return <div className="text-center py-20 text-slate-500 text-sm">Caricamento piano ETF...</div>;
  if (error) return <div className="text-center py-20 text-rose-400 text-sm">{error}</div>;
  if (!plan) return <div className="text-center py-20 text-slate-500 text-sm">Nessun dato disponibile</div>;

  const monthly = plan.recommended_monthly || 0;
  const monthsAnalyzed = plan.months || 0;
  const history = (plan.series || []).slice(-6);
  const step = Math.max(1, Math.floor(horizon / 8));

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
            <p className="text-xs text-slate-400 mb-1">Mediamente investibile</p>
            <p className="text-2xl font-black text-slate-200">{fmt(plan.med_investable)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Investito/mese (mediana)</p>
            <p className="text-lg font-black text-slate-300">{fmt(plan.med_invested)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Mesi con investimenti</p>
            <p className="text-lg font-black text-slate-200">
              {plan.months_invested || 0}
              <span className="text-xs text-slate-500 font-normal"> / {monthsAnalyzed}</span>
            </p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-white/5">
          Mediana su {monthsAnalyzed} mesi · buffer {(plan.buffer * 100).toFixed(0)}% · la proiezione usa
          il consigliato mensile.
        </p>
      </div>

      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Proiezione futura</h3>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">Orizzonte (anni)</label>
            <input type="range" min={1} max={40} value={horizon} onChange={(event) => setHorizon(+event.target.value)} className="w-full accent-violet-500" />
            <span className="text-xs text-slate-400 font-mono">{horizon} anni</span>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">Rendimento annuo</label>
            <input type="range" min={0} max={0.15} step={0.005} value={annualReturn} onChange={(event) => setAnnualReturn(+event.target.value)} className="w-full accent-violet-500" />
            <span className="text-xs text-slate-400 font-mono">{pct(annualReturn)}/anno</span>
          </div>
        </div>
        <div className="space-y-2">
          {projections
            .filter((row, index) => index % step === 0 || index === projections.length - 1)
            .map((row) => (
              <div key={row.year} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5">
                <span className="text-sm text-slate-400">Anno {row.year}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">Versato: {fmt(row.contributed)}</span>
                  <span className="text-sm font-bold text-violet-300 font-mono">{fmt(row.value)}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Ultimi mesi</h3>
          <div className="space-y-2">
            {history.map((row) => (
              <div key={row.month} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5">
                <span className="text-sm text-slate-400">{monthLabel(row.month)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500">investito {fmt(row.invested)}</span>
                  <span className={`text-sm font-bold font-mono ${row.investable >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>
                    {fmt(row.investable)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
