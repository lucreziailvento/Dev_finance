import { useState } from 'react';
import { catColor } from '../constants';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

export default function BudgetView({ categories, budgets, averages, onSetBudget }) {
  const [editKey, setEditKey] = useState(null);
  const [editVal, setEditVal] = useState('');

  const budgetMap = budgets || {};
  const spending = Object.fromEntries((categories || []).map((category) => [category.name, category.amount || 0]));

  const suggested = Object.fromEntries(
    (averages?.category_averages || []).map((row) => [row.name, row.med_amount || 0]),
  );

  // Mostriamo le categorie reali del backend: quelle spese questo mese,
  // quelle con un budget salvato e quelle con una media storica.
  const names = [...new Set([
    ...Object.keys(spending),
    ...Object.keys(budgetMap),
    ...Object.keys(suggested),
  ])];

  const rows = names
    .map((name) => ({
      name,
      spent: spending[name] || 0,
      budget: budgetMap[name] ?? suggested[name] ?? 0,
      suggestion: suggested[name] ?? 0,
      isCustom: Object.prototype.hasOwnProperty.call(budgetMap, name),
    }))
    .sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));

  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
  const totalSpent = Object.values(spending).reduce((sum, value) => sum + value, 0);
  const totalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const startEdit = (row) => {
    setEditKey(row.name);
    setEditVal(String(Math.round(row.budget)));
  };

  const saveEdit = (name) => {
    const value = parseFloat(editVal);
    if (!Number.isNaN(value) && value >= 0) onSetBudget(name, value);
    setEditKey(null);
    setEditVal('');
  };

  if (rows.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-sm">Nessun dato di spesa disponibile.</p>
        <p className="text-slate-600 text-xs mt-1">Importa un estratto conto per generare i budget suggeriti.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Riepilogo Budget</h3>
          {averages?.num_months ? (
            <span className="text-[10px] text-slate-500">{averages.num_months} mesi di storico</span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Budget totale</p>
            <p className="text-2xl font-black text-cyan-300">{fmt(totalBudget)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Speso</p>
            <p className={`text-2xl font-black ${totalSpent <= totalBudget ? 'text-emerald-300' : 'text-rose-300'}`}>{fmt(totalSpent)}</p>
          </div>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${totalSpent <= totalBudget ? 'bg-gradient-to-r from-cyan-500 to-emerald-500' : 'bg-gradient-to-r from-rose-500 to-orange-500'}`}
            style={{ width: `${Math.min(totalPct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {totalSpent <= totalBudget
            ? `Rimanenti ${fmt(totalBudget - totalSpent)} su ${fmt(totalBudget)}`
            : `Superato di ${fmt(totalSpent - totalBudget)}`}
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const pct = row.budget > 0 ? (row.spent / row.budget) * 100 : 0;
          const isOver = row.spent > row.budget;
          const isEditing = editKey === row.name;

          return (
            <div key={row.name} className="bg-[#111827] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(row.name) }} />
                  <span className="text-sm font-semibold text-slate-200 truncate">{row.name}</span>
                  {!row.isCustom && (
                    <span className="text-[9px] uppercase tracking-wider text-slate-600">suggerito</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-bold font-mono ${isOver ? 'text-rose-400' : 'text-slate-300'}`}>
                    {fmt(row.spent)} /{' '}
                    {isEditing ? (
                      <input
                        type="number"
                        value={editVal}
                        onChange={(event) => setEditVal(event.target.value)}
                        onBlur={() => saveEdit(row.name)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') saveEdit(row.name);
                          if (event.key === 'Escape') { setEditKey(null); setEditVal(''); }
                        }}
                        className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-cyan-300 font-mono text-right focus:outline-none focus:border-cyan-500"
                        autoFocus
                      />
                    ) : (
                      <button onClick={() => startEdit(row)} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                        {fmt(row.budget)}
                      </button>
                    )}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isOver ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-gradient-to-r from-cyan-500 to-emerald-500'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px] text-slate-500">{pct.toFixed(0)}% utilizzato</span>
                <span className="text-[11px] text-slate-500">{fmt(row.budget - row.spent)} rimanenti</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
