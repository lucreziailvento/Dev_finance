import { useState } from 'react';
import { catColor } from '../constants';
import BudgetChip from './BudgetChip';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

export default function BudgetView({ month, budgetDays, budgetTotals, saveForecast, deleteForecast, categories, budgetAverages, budgetAllocations, saveAllocations, transactions }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ planned_income: 0, planned_expenses: 0, notes: '' });
  const [localAllocs, setLocalAllocs] = useState(null);
  const [showDays, setShowDays] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const startEdit = (day) => {
    setEditing(day.date);
    setForm({ planned_income: day.planned_income, planned_expenses: day.planned_expenses, notes: day.notes || '' });
  };

  const handleSave = async (date) => {
    if (form.planned_income === 0 && form.planned_expenses === 0 && form.notes === '') {
      await deleteForecast(date);
    } else {
      await saveForecast(date, form.planned_income, form.planned_expenses, form.notes);
    }
    setEditing(null);
  };

  const avg = budgetAverages || {};
  const categoryAverages = avg.category_averages || [];

  const currSpending = {};
  const expenseTx = transactions.filter(t => t.amount < 0 && t.macro_category !== 'Trasferimento Interno' && t.macro_category !== 'Investimenti');
  expenseTx.forEach(t => { currSpending[t.micro_category] = (currSpending[t.micro_category] || 0) + Math.abs(t.amount); });

  const allCatNames = [...new Set([...categoryAverages.map(c => c.name), ...categories.map(c => c.name), ...Object.keys(budgetAllocations)])].sort();
  const allocs = localAllocs || { ...budgetAllocations };
  const totalBudget = Object.values(allocs).reduce((s, v) => s + v, 0);
  const totalSpent = Object.values(currSpending).reduce((s, v) => s + v, 0);

  const medTotal = categoryAverages.reduce((s, c) => s + (c.med_amount || 0), 0);
  const suggestedAlloc = {};
  categoryAverages.forEach(c => {
    const refAmt = c.med_amount || c.mean_amount || 0;
    suggestedAlloc[c.name] = medTotal > 0 ? Math.round((refAmt / medTotal) * (avg.med_monthly_expenses || avg.mean_monthly_expenses || 0)) : 0;
  });

  const setAlloc = (cat, val) => {
    setLocalAllocs(a => ({ ...(a || budgetAllocations), [cat]: parseFloat(val) || 0 }));
  };

  const handleSaveAllocs = () => {
    const payload = Object.entries(localAllocs || budgetAllocations).map(([k, v]) => ({ micro_category: k, planned_amount: v }));
    saveAllocations(payload);
    setLocalAllocs(null);
  };

  const hasEdits = localAllocs !== null;

  return (
    <div className="pb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-white">Budget {month.replace('-', ' / ')}</h2>
        <button onClick={() => setShowDays(!showDays)} className="text-[9px] text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-1 rounded-lg">
          {showDays ? 'Nascondi giorni' : 'Budget giornaliero'}
        </button>
      </div>

      {avg.num_months > 0 && (
        <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/50 rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[8px] text-slate-500 font-semibold uppercase">Mediana mensile</span>
            <span className="text-[8px] text-slate-700">({avg.num_months} {avg.num_months === 1 ? 'mese' : 'mesi'})</span>
            <span className="text-[7px] text-slate-600 ml-auto">Media: {avg.mean_monthly_income?.toFixed(0)} / {avg.mean_monthly_expenses?.toFixed(0)}</span>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-emerald-500/5 rounded-xl px-3 py-2">
              <span className="text-[8px] text-emerald-400/50 font-semibold">Entrate</span>
              <p className="text-sm font-black text-emerald-300">+{avg.med_monthly_income?.toFixed(0)}</p>
            </div>
            <div className="flex-1 bg-rose-500/5 rounded-xl px-3 py-2">
              <span className="text-[8px] text-rose-400/50 font-semibold">Uscite</span>
              <p className="text-sm font-black text-rose-300">−{avg.med_monthly_expenses?.toFixed(0)}</p>
            </div>
            <div className="flex-1 bg-cyan-500/5 rounded-xl px-3 py-2">
              <span className="text-[8px] text-cyan-400/50 font-semibold">Risparmio</span>
              <p className="text-sm font-black text-cyan-300">+{((avg.med_monthly_income || 0) - (avg.med_monthly_expenses || 0)).toFixed(0)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/50 rounded-2xl p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Budget per categoria</h3>
          <div className="flex gap-1">
            <button onClick={() => { setLocalAllocs(allocs); Object.assign(allocs, suggestedAlloc); setLocalAllocs({...allocs}); }}
              className="text-[8px] text-violet-400 font-semibold bg-violet-500/10 px-2 py-1 rounded-lg">Suggerisci</button>
            <button onClick={() => setLocalAllocs({...budgetAllocations})}
              className="text-[8px] text-slate-500 px-2 py-1">Annulla</button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] text-slate-500">Stanziato: <span className="font-bold text-slate-300">{totalBudget.toFixed(0)}€</span></span>
          <span className="text-[10px] text-slate-500">Speso: <span className="font-bold text-rose-300">{totalSpent.toFixed(0)}€</span></span>
          {totalBudget > 0 && (
            <span className={`text-[10px] font-bold ${totalSpent <= totalBudget ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalSpent <= totalBudget ? `${((1 - totalSpent / totalBudget) * 100).toFixed(0)}% rimanenti` : `${((totalSpent / totalBudget - 1) * 100).toFixed(0)}% in eccesso`}
            </span>
          )}
        </div>
        <div className="space-y-2.5">
          {allCatNames.length === 0 ? (
            <p className="text-slate-600 text-xs py-4 text-center">Nessuna categoria</p>
          ) : (
            allCatNames.map(cat => {
              const avgCat = categoryAverages.find(c => c.name === cat);
              const avgAmt = avgCat ? (avgCat.med_amount || avgCat.mean_amount || 0) : 0;
              const currAmt = currSpending[cat] || 0;
              const planned = allocs[cat] || 0;
              const pct = planned > 0 ? (currAmt / planned) * 100 : 0;
              const barColor = pct > 100 ? '#fb7185' : pct > 80 ? '#fbbf24' : catColor(cat);
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(cat) }} />
                    <span className="text-[11px] text-slate-400 flex-1 truncate">{cat}</span>
                    <span className="text-[9px] text-slate-600 font-mono w-14 text-right">{avgAmt > 0 ? avgAmt.toFixed(0) : '−'}</span>
                    <input type="number" step="10" value={planned || ''} placeholder="0" onChange={e => setAlloc(cat, e.target.value)}
                      className="w-20 bg-slate-950 border border-slate-800/40 rounded-lg px-2 py-1 text-[11px] text-right text-slate-200 outline-none focus:border-cyan-500/40 placeholder:text-slate-700 font-mono" />
                    <span className={`text-[10px] font-mono font-bold w-14 text-right ${currAmt > planned && planned > 0 ? 'text-rose-400' : currAmt > 0 ? 'text-emerald-400' : 'text-slate-700'}`}>
                      {currAmt > 0 ? currAmt.toFixed(0) : '−'}
                    </span>
                  </div>
                  {planned > 0 && (
                    <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                    </div>
                  )}
                  <div className="flex justify-between text-[7px] text-slate-700 px-0.5">
                    <span>Mediana {avgAmt > 0 ? avgAmt.toFixed(0) + '€' : ''}</span>
                    <span>{planned > 0 ? 'Budget ' + planned.toFixed(0) + '€' : ''}</span>
                    <span>{currAmt > 0 ? 'Speso ' + currAmt.toFixed(0) + '€' : ''}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {hasEdits && (
          <button onClick={handleSaveAllocs}
            className="w-full mt-3 bg-cyan-500/15 text-cyan-400 font-bold text-xs py-2.5 rounded-xl border border-cyan-500/30 active:bg-cyan-500/25">
            Salva budget categorie
          </button>
        )}
      </div>

      {showDays && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <BudgetChip label="Prev. Risparmio" value={(budgetTotals.planned_income - budgetTotals.planned_expenses).toFixed(0)} color="text-emerald-300" bg="bg-emerald-500/10" />
            <BudgetChip label="Eff. Risparmio" value={(budgetTotals.actual_income - budgetTotals.actual_expenses).toFixed(0)} color="text-cyan-300" bg="bg-cyan-500/10" />
            <BudgetChip label="Delta" value={((budgetTotals.actual_income - budgetTotals.actual_expenses) - (budgetTotals.planned_income - budgetTotals.planned_expenses)).toFixed(0)} color="text-violet-300" bg="bg-violet-500/10" />
            <BudgetChip label="Giorni" value={`${budgetDays.filter(d => d.planned_income > 0 || d.planned_expenses > 0).length}/${budgetDays.length}`} color="text-slate-300" bg="bg-slate-500/10" />
          </div>

          <div className="space-y-1.5">
            {budgetDays.map(day => {
              const d = new Date(day.date + 'T12:00:00');
              const dayLabel = DAYS[d.getDay()];
              const isEditing = editing === day.date;
              const plannedBal = day.planned_income - day.planned_expenses;
              const isToday = day.date === today;
              const hasData = day.planned_income > 0 || day.planned_expenses > 0 || day.actual_income > 0 || day.actual_expenses > 0;

              if (!hasData && !isEditing) return null;

              return (
                <div key={day.date}
                  onClick={() => !isEditing && startEdit(day)}
                  className={`rounded-2xl border transition-all active:scale-[0.99] ${isToday ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-slate-800/40 bg-slate-900/40'} ${isEditing ? 'border-cyan-500/50 bg-slate-900' : ''}`}>
                  <div className="px-3.5 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">{day.date.slice(8)}</span>
                        <span className="text-[9px] text-slate-600">{dayLabel}</span>
                        {isToday && <span className="text-[8px] text-cyan-400 font-semibold bg-cyan-500/10 px-1.5 py-0.5 rounded">Oggi</span>}
                      </div>
                      {!isEditing && plannedBal !== 0 && (
                        <span className={`text-[10px] font-bold font-mono ${plannedBal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {plannedBal >= 0 ? '+' : ''}{plannedBal.toFixed(0)}
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2 mt-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[8px] text-emerald-400/60 font-semibold uppercase">Entrate</label>
                            <input type="number" step="0.01" value={form.planned_income} onChange={e => setForm(f => ({ ...f, planned_income: parseFloat(e.target.value) || 0 }))} autoFocus
                              className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2 text-sm text-emerald-300 outline-none text-right" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[8px] text-rose-400/60 font-semibold uppercase">Uscite</label>
                            <input type="number" step="0.01" value={form.planned_expenses} onChange={e => setForm(f => ({ ...f, planned_expenses: parseFloat(e.target.value) || 0 }))}
                              className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2 text-sm text-rose-300 outline-none text-right" />
                          </div>
                        </div>
                        <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Note (opzionale)"
                          className="w-full bg-slate-950/60 border border-slate-800/50 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none placeholder:text-slate-600" />
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => handleSave(day.date)} className="flex-1 bg-cyan-500/15 text-cyan-400 font-bold text-xs py-2.5 rounded-xl border border-cyan-500/30 active:bg-cyan-500/25">Salva</button>
                          <button onClick={() => setEditing(null)} className="flex-1 bg-slate-800 text-slate-400 font-bold text-xs py-2.5 rounded-xl border border-slate-700/50 active:bg-slate-700">Annulla</button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-emerald-500/5 rounded-lg px-2 py-1">
                            <span className="text-[8px] text-emerald-400/50 font-semibold">Entrate</span>
                            <div className="flex justify-between">
                              <span className="text-[10px] text-emerald-400/50 font-mono">{day.actual_income > 0 ? day.actual_income.toFixed(0) : '−'}</span>
                              {day.planned_income > 0 && <span className="text-[10px] text-emerald-300 font-mono">{day.planned_income.toFixed(0)}</span>}
                            </div>
                          </div>
                          <div className="flex-1 bg-rose-500/5 rounded-lg px-2 py-1">
                            <span className="text-[8px] text-rose-400/50 font-semibold">Uscite</span>
                            <div className="flex justify-between">
                              <span className="text-[10px] text-rose-400/50 font-mono">{day.actual_expenses > 0 ? day.actual_expenses.toFixed(0) : '−'}</span>
                              {day.planned_expenses > 0 && <span className="text-[10px] text-rose-300 font-mono">{day.planned_expenses.toFixed(0)}</span>}
                            </div>
                          </div>
                        </div>
                        {day.notes && <span className="text-[8px] text-slate-600 truncate col-span-2">{day.notes}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/50 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] text-slate-500 font-semibold uppercase">Previsto</p>
                <p className="text-xs font-black text-emerald-300">+{budgetTotals.planned_income.toFixed(0)}</p>
                <p className="text-xs font-black text-rose-300">−{budgetTotals.planned_expenses.toFixed(0)}</p>
                <p className={`text-sm font-black mt-0.5 ${(budgetTotals.planned_income - budgetTotals.planned_expenses) >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                  = {(budgetTotals.planned_income - budgetTotals.planned_expenses).toFixed(2)}€
                </p>
              </div>
              <div>
                <p className="text-[8px] text-slate-500 font-semibold uppercase">Effettivo</p>
                <p className="text-xs font-black text-emerald-300">+{budgetTotals.actual_income.toFixed(0)}</p>
                <p className="text-xs font-black text-rose-300">−{budgetTotals.actual_expenses.toFixed(0)}</p>
                <p className={`text-sm font-black mt-0.5 ${(budgetTotals.actual_income - budgetTotals.actual_expenses) >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                  = {(budgetTotals.actual_income - budgetTotals.actual_expenses).toFixed(2)}€
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
