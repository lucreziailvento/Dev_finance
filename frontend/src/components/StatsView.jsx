import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../api';
import { COLORS, monthLabel } from '../constants';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function StatsView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.stats()
      .then((payload) => { if (active) setStats(payload); })
      .catch((exc) => { if (active) setError(exc.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Il backend restituisce array {name, amount} / {source, amount}: qui li
  // trasformiamo in mappe mese -> valore, che e' la forma usata dai grafici.
  const categoryPerMonth = useMemo(() => {
    const result = {};
    Object.entries(stats?.categories_per_month || {}).forEach(([month, rows]) => {
      result[month] = Object.fromEntries(rows.map((row) => [row.name, toNumber(row.amount)]));
    });
    return result;
  }, [stats]);

  const sourcesPerMonth = useMemo(() => {
    const result = {};
    Object.entries(stats?.sources_per_month || {}).forEach(([month, rows]) => {
      result[month] = Object.fromEntries(
        rows.filter((row) => toNumber(row.amount) > 0).map((row) => [row.source, toNumber(row.amount)]),
      );
    });
    return result;
  }, [stats]);

  if (loading) return <div className="text-center py-20 text-slate-500 text-sm">Caricamento statistiche...</div>;
  if (error) return <div className="text-center py-20 text-rose-400 text-sm">{error}</div>;
  if (!stats) return <div className="text-center py-20 text-slate-500 text-sm">Nessun dato disponibile</div>;

  const topDescriptions = stats.top_descriptions || [];

  const allMonths = [...new Set([
    ...Object.keys(categoryPerMonth),
    ...Object.keys(sourcesPerMonth),
  ])].sort().slice(-12);

  const monthData = allMonths.map((month) => {
    const row = { month, label: monthLabel(month) };
    Object.entries(categoryPerMonth[month] || {}).forEach(([name, amount]) => { row[`cat_${name}`] = amount; });
    Object.entries(sourcesPerMonth[month] || {}).forEach(([source, amount]) => { row[`src_${source}`] = amount; });
    return row;
  });

  const allCategories = [...new Set(allMonths.flatMap((month) => Object.keys(categoryPerMonth[month] || {})))];
  const allSources = [...new Set(allMonths.flatMap((month) => Object.keys(sourcesPerMonth[month] || {})))];

  const catColors = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#a855f7', '#f472b6'];

  return (
    <div className="space-y-5">
      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Spese per categoria nel tempo</h3>
        {allCategories.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">Nessun dato</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, fontSize: 11 }} formatter={(v, n) => [fmt(v), n]} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                {allCategories.map((category, index) => (
                  <Bar key={category} dataKey={`cat_${category}`} name={category} fill={catColors[index % catColors.length]} stackId="a" radius={index === allCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Movimenti per sorgente nel tempo</h3>
        {allSources.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">Nessun dato</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, fontSize: 11 }} formatter={(v, n) => [fmt(v), n]} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                {allSources.map((source, index) => (
                  <Bar key={source} dataKey={`src_${source}`} name={source} fill={[COLORS.income, COLORS.savings, COLORS.invested, COLORS.transfers][index % 4]} stackId="b" radius={index === allSources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Descrizioni più frequenti</h3>
        {topDescriptions.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">Nessun dato</p>
        ) : (
          <div className="space-y-2">
            {topDescriptions.slice(0, 20).map((item, index) => (
              <div key={`${item.description}-${index}`} className="flex items-center gap-3 py-2 px-1 rounded-xl hover:bg-white/5 transition-colors">
                <span className="text-xs text-slate-500 font-mono w-6 text-center">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{item.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400">{item.count}x</span>
                  <span className="text-sm font-bold font-mono text-rose-400">{fmt(item.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
