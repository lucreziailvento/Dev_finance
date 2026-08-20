import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../api';
import { MONTH_LABELS, COLORS } from '../constants';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

export default function StatsView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api.stats().then(j => { setStats(j); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-slate-500 text-sm">Caricamento statistiche...</div>;
  if (!stats) return <div className="text-center py-20 text-slate-500 text-sm">Nessun dato disponibile</div>;

  const categoryPerMonth = stats.category_per_month || {};
  const sourcesPerMonth = stats.sources_per_month || {};
  const topDescs = stats.top_descriptions || [];

  const allMonths = [...new Set([
    ...Object.keys(categoryPerMonth),
    ...Object.keys(sourcesPerMonth)
  ])].sort().slice(-12);

  const monthData = allMonths.map(m => {
    const cats = categoryPerMonth[m] || {};
    const srcs = sourcesPerMonth[m] || {};
    const row = { month: m, label: MONTH_LABELS[m] || m };
    Object.entries(cats).forEach(([k, v]) => { row[`cat_${k}`] = v; });
    Object.entries(srcs).forEach(([k, v]) => { row[`src_${k}`] = v; });
    return row;
  });

  const allCats = [...new Set(allMonths.flatMap(m => Object.keys(categoryPerMonth[m] || {})))];
  const allSrcs = [...new Set(allMonths.flatMap(m => Object.keys(sourcesPerMonth[m] || {})))];

  const catColors = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#a855f7', '#f472b6'];

  return (
    <div className="space-y-5">
      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Spese per categoria nel tempo</h3>
        {allCats.length === 0 ? (
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
                {allCats.map((cat, i) => (
                  <Bar key={cat} dataKey={`cat_${cat}`} name={cat} fill={catColors[i % catColors.length]} stackId="a" radius={i === allCats.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Entrate per sorgente nel tempo</h3>
        {allSrcs.length === 0 ? (
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
                {allSrcs.map((src, i) => (
                  <Bar key={src} dataKey={`src_${src}`} name={src} fill={[COLORS.income, COLORS.savings, COLORS.invested, COLORS.transfers][i % 4]} stackId="b" radius={i === allSrcs.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-[#111827] border border-white/5 rounded-3xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Descrizioni più frequenti</h3>
        {topDescs.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">Nessun dato</p>
        ) : (
          <div className="space-y-2">
            {topDescs.slice(0, 20).map((d, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-1 rounded-xl hover:bg-white/5 transition-colors">
                <span className="text-xs text-slate-500 font-mono w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{d.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400">{d.count}x</span>
                  <span className="text-sm font-bold font-mono text-rose-400">{fmt(d.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
