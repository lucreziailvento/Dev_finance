import { useState } from 'react';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

const BUDGET_CATS = [
  { name: 'Alimentari & Bevande', icon: '🛒', suggested: 400 },
  { name: 'Casa & Bollette', icon: '🏠', suggested: 800 },
  { name: 'Trasporti', icon: '🚗', suggested: 200 },
  { name: 'Shopping', icon: '🛍️', suggested: 200 },
  { name: 'Salute & Benessere', icon: '💊', suggested: 100 },
  { name: 'Tempo Libero & Intrattenimento', icon: '🎮', suggested: 150 },
  { name: 'Ristoranti & Caffè', icon: '☕', suggested: 200 },
  { name: 'Abbonamenti & Digitali', icon: '📱', suggested: 100 },
  { name: 'Formazione & Crescita', icon: '📚', suggested: 50 },
  { name: 'Animali domestici', icon: '🐾', suggested: 50 },
];

export default function BudgetView({ categories, onSetBudget, budgets }) {
  const [editKey, setEditKey] = useState(null);
  const [editVal, setEditVal] = useState('');

  const budgetMap = budgets || {};
  const totalBudget = BUDGET_CATS.reduce((s, c) => s + (budgetMap[c.name] || c.suggested), 0);
  const totalSpent = categories.reduce((s, c) => s + c.amount, 0);

  const handleSave = (catName) => {
    const val = parseFloat(editVal);
    if (!isNaN(val) && val >= 0) {
      onSetBudget(catName, val);
    }
    setEditKey(null);
    setEditVal('');
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Riepilogo Budget</h3>
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
            style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {totalSpent <= totalBudget
            ? `Rimanenti ${fmt(totalBudget - totalSpent)} su ${fmt(totalBudget)}`
            : `Superato di ${fmt(totalSpent - totalBudget)}`}
        </p>
      </div>

      <div className="space-y-3">
        {BUDGET_CATS.map(bc => {
          const actual = categories.find(c => c.name === bc.name)?.amount || 0;
          const budget = budgetMap[bc.name] || bc.suggested;
          const pct = budget > 0 ? (actual / budget) * 100 : 0;
          const isOver = actual > budget;
          const isEditing = editKey === bc.name;

          return (
            <div key={bc.name} className="bg-[#111827] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{bc.icon}</span>
                  <span className="text-sm font-semibold text-slate-200">{bc.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold font-mono ${isOver ? 'text-rose-400' : 'text-slate-300'}`}>
                    {fmt(actual)} / {isEditing ? (
                      <input
                        type="number"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onBlur={() => handleSave(bc.name)}
                        onKeyDown={e => e.key === 'Enter' && handleSave(bc.name)}
                        className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-cyan-300 font-mono text-right focus:outline-none focus:border-cyan-500"
                        autoFocus
                      />
                    ) : (
                      <button onClick={() => { setEditKey(bc.name); setEditVal(String(budget)); }} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                        {fmt(budget)}
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
                <span className="text-[11px] text-slate-500">{fmt(budget - actual)} rimanenti</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
