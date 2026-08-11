import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { api } from '../api';
import { MONTH_LABELS } from '../constants';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

function projection(monthly, annualPct, years) {
  const r = annualPct / 100 / 12;
  const n = years * 12;
  const points = [];
  let balance = 0;
  for (let i = 1; i <= n; i++) {
    balance = balance * (1 + r) + monthly;
    if (i % 12 === 0) {
      points.push({ year: `${Math.round(i / 12)} anno`, valore: Math.round(balance) });
    }
  }
  return { points, final: balance };
}

export default function EtfView() {
  const [plan, setPlan] = useState(null);
  const [months, setMonths] = useState(12);
  const [buffer, setBuffer] = useState(0.2);
  const [monthly, setMonthly] = useState(0);
  const [rate, setRate] = useState(5);
  const [years, setYears] = useState(10);

  useEffect(() => {
    api.etfPlan(months, buffer).then(j => {
      if (!j.error) {
        setPlan(j);
        setMonthly(j.recommended_monthly || 0);
      }
    });
  }, [months, buffer]);

  const proj = useMemo(() => projection(monthly || 0, rate, years), [monthly, rate, years]);

  const chartData = useMemo(() => (plan?.series || []).map(m => ({
    label: MONTH_LABELS[m.month] || m.month,
    investable: m.investable,
  })), [plan]);

  if (!plan) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full" />
        <span className="ml-3 text-cyan-400 text-xs font-medium">Calcolo piano ETF...</span>
      </div>
    );
  }

  return (
    <div className="pb-2 space-y-3">
      <div className="bg-gradient-to-br from-violet-900/40 to-slate-900/40 border border-violet-500/20 rounded-2xl p-5 text-center">
        <p className="text-[9px] text-violet-300/60 font-semibold uppercase tracking-wider">Importo mensile suggerito</p>
        <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-cyan-300 mt-1">{fmt(plan.recommended_monthly)}</p>
        <p className="text-[9px] text-slate-500 mt-2">Calcolato sulla mediana degli ultimi {plan.months} mesi, con margine di sicurezza del {Math.round(plan.buffer * 100)}%</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-3">
          <p className="text-[8px] text-slate-500 font-semibold uppercase">Entrate mediane</p>
          <p className="text-sm font-black text-emerald-300 mt-0.5">{fmt(plan.med_income)}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-3">
          <p className="text-[8px] text-slate-500 font-semibold uppercase">Spese mediane</p>
          <p className="text-sm font-black text-rose-300 mt-0.5">{fmt(plan.med_expenses)}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-3">
          <p className="text-[8px] text-slate-500 font-semibold uppercase">Risparmio investibile</p>
          <p className="text-sm font-black text-teal-300 mt-0.5">{fmt(plan.med_investable)}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-3">
          <p className="text-[8px] text-slate-500 font-semibold uppercase">Già investito/mese</p>
          <p className="text-sm font-black text-violet-300 mt-0.5">{fmt(plan.med_invested)}</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Capacità mensile</h3>
          <div className="flex gap-1">
            {[6, 12, 24].map(m => (
              <button key={m} onClick={() => setMonths(m)}
                className={`text-[9px] px-2 py-1 rounded-lg font-semibold transition-all ${months === m ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-500'}`}>
                {m} mesi
              </button>
            ))}
          </div>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(34,211,238,0.05)' }} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }} formatter={(v) => [fmt(v), 'Investibile']} />
              <Bar dataKey="investable" radius={[4, 4, 0, 0]} fill="#2dd4bf" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/50 rounded-2xl p-4">
        <h3 className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Proiezione investimento</h3>

        <div className="space-y-4 mb-4">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-500 font-semibold">Versamento mensile</span>
              <span className="font-bold text-cyan-300 font-mono">{fmt(monthly)}</span>
            </div>
            <input type="range" min={50} max={2000} step={10} value={monthly} onChange={e => setMonthly(+e.target.value)}
              className="w-full accent-cyan-400" />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-500 font-semibold">Rendimento annuo</span>
              <span className="font-bold text-violet-300 font-mono">{rate}%</span>
            </div>
            <input type="range" min={1} max={12} step={0.5} value={rate} onChange={e => setRate(+e.target.value)}
              className="w-full accent-violet-400" />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-500 font-semibold">Orizzonte</span>
              <span className="font-bold text-emerald-300 font-mono">{years} anni</span>
            </div>
            <input type="range" min={1} max={40} step={1} value={years} onChange={e => setYears(+e.target.value)}
              className="w-full accent-emerald-400" />
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/30 rounded-xl p-4 text-center mb-3">
          <p className="text-[8px] text-slate-500 font-semibold uppercase">Valore futuro stimato</p>
          <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300 mt-0.5">{fmt(proj.final)}</p>
          <p className="text-[9px] text-slate-600 mt-1">{fmt(monthly * years * 12)} versati · {fmt(proj.final - monthly * years * 12)} di interessi composti</p>
        </div>

        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={proj.points} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }} formatter={(v) => [fmt(v), 'Valore']} />
              <Line type="monotone" dataKey="valore" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2, fill: '#22d3ee' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[8px] text-slate-700 mt-2 text-center">Simulazione indicativa: rendimento costante, nessun prelievo o tassa. Non è un consiglio finanziario.</p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-slate-500 font-semibold">Margine di sicurezza</span>
          <span className="text-[10px] font-bold text-slate-300">{Math.round(buffer * 100)}%</span>
        </div>
        <input type="range" min={0} max={50} step={5} value={Math.round(buffer * 100)} onChange={e => setBuffer(+e.target.value / 100)}
          className="w-full accent-slate-400" />
        <p className="text-[8px] text-slate-600 mt-1">Riduce l'importo raccomandato per assorbire mesi difficili.</p>
      </div>
    </div>
  );
}
