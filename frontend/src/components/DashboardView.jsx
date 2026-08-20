import { useEffect, useState, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api';
import { MONTH_LABELS, COLORS, CATEGORIES } from '../constants';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

function MetricCard({ label, value, icon, color, gradient }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} border border-white/5 rounded-2xl p-4 transition-all active:scale-[0.98]`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-black" style={{ color }}>{fmt(value)}</p>
    </div>
  );
}

function InlineEdit({ value, onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value && draft.trim()) onSave(draft.trim());
    else setDraft(value);
  };

  if (editing) {
    return (
      <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className={`bg-slate-800 border border-cyan-500 rounded-lg px-2 py-0.5 text-sm text-slate-100 focus:outline-none ${className}`} />
    );
  }
  return (
    <button onClick={() => { setDraft(value); setEditing(true); }} className={`text-left hover:bg-white/5 rounded-lg px-2 py-0.5 transition-colors ${className}`}>
      {value}
    </button>
  );
}

function CategorySelect({ value, onChange, className }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`text-xs hover:bg-white/5 rounded-lg px-2 py-0.5 transition-colors ${className}`}>
        {value}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-20 bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-h-48 overflow-y-auto min-w-[200px] py-1">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => { onChange(cat); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${cat === value ? 'text-cyan-400 font-bold' : 'text-slate-300'}`}>
                {cat}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardView({ data, categories, transactions, catColor, onSelectCategory, selectedCategory, onOpenLedger, onUpdateDescription, onUpdateCategory }) {
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    api.trend(12).then(j => { if (j.series) setTrend(j.series); }).catch(() => {});
  }, []);

  const d = data || {};
  const income = d.income ?? 0;
  const expenses = d.expenses ?? 0;
  const savings = d.savings ?? 0;
  const invested = d.invested ?? 0;
  const investable = d.investable ?? 0;

  const chartData = trend.map(m => ({
    label: MONTH_LABELS[m.month] || m.month,
    Entrate: m.income,
    Uscite: m.expenses,
  }));

  const totalExpenses = categories.reduce((s, c) => s + c.amount, 0);

  const renderTx = (t, i) => {
    const isExpense = t.amount < 0;
    const dotColor = isExpense ? COLORS.expenses : t.macro_category === 'Trasferimento Interno' ? COLORS.transfers : t.macro_category === 'Investimenti' ? COLORS.invested : COLORS.income;
    return (
      <div key={t.hash_id || i} className="flex items-center gap-3 py-2.5 px-1 rounded-xl hover:bg-white/5 transition-colors">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
        <div className="flex-1 min-w-0">
          <InlineEdit value={t.description} onSave={v => onUpdateDescription(t, v)} className="text-sm text-slate-200 truncate block w-full" />
          <CategorySelect value={t.micro_category} onChange={v => onUpdateCategory(t, v)} className="text-xs text-slate-500" />
        </div>
        <span className={`text-sm font-bold font-mono ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}>
          {isExpense ? '−' : '+'}{fmt(Math.abs(t.amount))}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Entrate" value={income} icon="↗" color={COLORS.income} gradient="from-emerald-500/20 to-emerald-500/5" />
        <MetricCard label="Spese" value={expenses} icon="↘" color={COLORS.expenses} gradient="from-rose-500/20 to-rose-500/5" />
        <MetricCard label="Risparmio" value={savings} icon="⚡" color={savings >= 0 ? COLORS.savings : COLORS.expenses} gradient="from-cyan-500/20 to-cyan-500/5" />
        <MetricCard label="Investito" value={invested} icon="📊" color={COLORS.invested} gradient="from-violet-500/20 to-violet-500/5" />
      </div>

      {investable !== 0 && (
        <div className={`rounded-2xl p-4 border ${investable >= 0 ? 'bg-teal-500/10 border-teal-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400">Disponibile per investire</span>
            <span className={`text-2xl font-black ${investable >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>{fmt(investable)}</span>
          </div>
        </div>
      )}

      {chartData.length > 1 && (
        <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Andamento 12 mesi</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.income} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.income} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.expenses} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.expenses} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, fontSize: 12 }} formatter={(v, n) => [fmt(v), n]} />
                <Area type="monotone" dataKey="Entrate" stroke={COLORS.income} fill="url(#gInc)" strokeWidth={2.5} dot={{ r: 3, fill: COLORS.income }} />
                <Area type="monotone" dataKey="Uscite" stroke={COLORS.expenses} fill="url(#gExp)" strokeWidth={2.5} dot={{ r: 3, fill: COLORS.expenses }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Spese per categoria</h3>
        {categories.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">Nessuna spesa questo mese</p>
        ) : (
          <div className="space-y-3">
            {categories.map(c => {
              const pct = totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0;
              const isSelected = selectedCategory === c.name;
              return (
                <button key={c.name}
                  onClick={() => onSelectCategory(isSelected ? null : c.name)}
                  className={`w-full text-left rounded-xl p-3 transition-all ${isSelected ? 'bg-white/5 ring-1 ring-white/10' : 'hover:bg-white/5'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(c.name) }} />
                      <span className="text-sm text-slate-300">{c.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-200 font-mono">{fmt(c.amount)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: catColor(c.name) }} />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">{pct.toFixed(0)}% del totale</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ultime transazioni</h3>
          <button onClick={onOpenLedger} className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors">Vedi tutte →</button>
        </div>
        {(!transactions || transactions.length === 0) ? (
          <p className="text-slate-600 text-sm text-center py-6">Nessuna transazione</p>
        ) : (
          <div className="space-y-1">
            {transactions.slice(0, 8).map(renderTx)}
          </div>
        )}
      </div>
    </div>
  );
}
