import { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api';
import { COLORS, monthLabel } from '../constants';
import TransactionRow from './TransactionRow';

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

export default function DashboardView({
  data,
  categories,
  transactions,
  catColor,
  onSelectCategory,
  selectedCategory,
  onOpenLedger,
  onUpdateDescription,
  onUpdateCategory,
  onUpdateAmount,
}) {
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    let active = true;
    api.trend(12)
      .then((payload) => { if (active && payload?.series) setTrend(payload.series); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const income = data?.income ?? 0;
  const expenses = data?.expenses ?? 0;
  const savings = data?.savings ?? 0;
  const invested = data?.invested ?? 0;
  const investable = data?.investable ?? 0;

  const chartData = trend.map((row) => ({
    label: monthLabel(row.month),
    Entrate: row.income,
    Uscite: row.expenses,
  }));

  const totalExpenses = categories.reduce((sum, category) => sum + category.amount, 0);

  const renderTx = (tx, index) => (
    <TransactionRow
      key={tx.hash_id || index}
      tx={tx}
      onUpdateDescription={onUpdateDescription}
      onUpdateCategory={onUpdateCategory}
      onUpdateAmount={onUpdateAmount}
    />
  );

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
            {categories.map((category) => {
              const pct = totalExpenses > 0 ? (category.amount / totalExpenses) * 100 : 0;
              const isSelected = selectedCategory === category.name;
              return (
                <button key={category.name}
                  onClick={() => onSelectCategory(isSelected ? null : category.name)}
                  className={`w-full text-left rounded-xl p-3 transition-all ${isSelected ? 'bg-white/5 ring-1 ring-white/10' : 'hover:bg-white/5'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(category.name) }} />
                      <span className="text-sm text-slate-300">{category.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-200 font-mono">{fmt(category.amount)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: catColor(category.name) }} />
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
        {!transactions || transactions.length === 0 ? (
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
