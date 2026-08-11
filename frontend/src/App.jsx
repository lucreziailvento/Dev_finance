import { useState, useCallback, useRef } from 'react';
import { CATEGORIES, MONTHS, MONTH_FULL, catColor } from './constants';
import { apiBase } from './api';
import { useFinance } from './hooks/useFinance';
import MetricBox from './components/MetricBox';
import SummaryCard from './components/SummaryCard';
import BudgetView from './components/BudgetView';
import EtfView from './components/EtfView';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

export default function App() {
  const [month, setMonth] = useState('2026-06');
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('all');
  const [activeMetric, setActiveMetric] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsUrl, setSettingsUrl] = useState(apiBase());
  const [showMenu, setShowMenu] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [fineco, setFineco] = useState(null);
  const [revolut, setRevolut] = useState(null);
  const ledgerRef = useRef(null);

  const [mType, setMType] = useState('spesa');
  const [mDate, setMDate] = useState('2026-06-01');
  const [mDesc, setMDesc] = useState('');
  const [mAmount, setMAmount] = useState('');
  const [mCat, setMCat] = useState('Spesa Alimentare');

  const {
    data, forecast, budgetAverages, budgetAllocations, loading,
    ingest, addManual, updDesc, updCat, delManual,
    saveForecast, deleteForecast, saveAllocations,
  } = useFinance(month);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ id: Date.now(), msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleIngest = async () => {
    if (!fineco || !revolut) { showToast('Seleziona entrambi i file', 'warning'); return; }
    const res = await ingest(fineco, revolut);
    if (res.ok) {
      showToast(`${res.records_added} nuovi record`, 'success');
      setFineco(null); setRevolut(null);
    } else {
      showToast(res.error, 'error');
    }
  };

  const addManualHandler = async (e) => {
    e.preventDefault();
    if (!mDesc || !mAmount) return;
    await addManual({ date: mDate, description: mDesc, amount: parseFloat(mAmount), micro_category: mCat, type: mType });
    setMDesc(''); setMAmount(''); setShowForm(false);
    showToast('Movimento registrato', 'success');
  };

  const handleMetricClick = (key) => {
    const next = activeMetric === key ? null : key;
    setActiveMetric(next);
    if (next && ledgerRef.current) {
      setTimeout(() => ledgerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const d = data || {};
  const income = d.income ?? 0;
  const expenses = d.expenses ?? 0;
  const savings = d.savings ?? 0;
  const invested = d.invested ?? 0;
  const investable = d.investable ?? 0;
  const transfers = d.transfers ?? 0;
  const categories = d.categories || [];
  const transactions = d.transactions || [];

  const filteredTx = transactions.filter(t => {
    if (selectedCategory && t.micro_category !== selectedCategory) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeMetric === 'income') return t.macro_category === 'Entrate';
    if (activeMetric === 'expenses') return t.amount < 0 && t.macro_category !== 'Trasferimento Interno' && t.macro_category !== 'Investimenti';
    if (activeMetric === 'savings') return t.macro_category !== 'Trasferimento Interno' && t.macro_category !== 'Investimenti';
    if (activeMetric === 'invested') return t.macro_category === 'Investimenti';
    if (activeMetric === 'investable') return t.macro_category !== 'Trasferimento Interno' && t.macro_category !== 'Investimenti';
    if (filter === 'income') return t.macro_category === 'Entrate';
    if (filter === 'expense') return t.macro_category !== 'Entrate' && t.macro_category !== 'Trasferimento Interno';
    return true;
  });

  const groups = {};
  filteredTx.forEach(t => { if (!groups[t.date]) groups[t.date] = []; groups[t.date].push(t); });
  const sortedDates = Object.keys(groups).sort();
  const totalExpenses = categories.reduce((s, c) => s + c.amount, 0);

  const [yearStr, monthStr] = month.split('-');
  const daysInMonth = new Date(+yearStr, +monthStr, 0).getDate();
  const forecastMap = {};
  forecast.forecasts.forEach(f => { forecastMap[f.date] = f; });
  const budgetDays = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const f = forecastMap[date] || { planned_income: 0, planned_expenses: 0, notes: '' };
    const a = forecast.actuals[date] || { actual_income: 0, actual_expenses: 0 };
    return { date, ...f, ...a };
  });
  const budgetTotals = budgetDays.reduce((acc, d) => ({
    planned_income: acc.planned_income + d.planned_income,
    planned_expenses: acc.planned_expenses + d.planned_expenses,
    actual_income: acc.actual_income + d.actual_income,
    actual_expenses: acc.actual_expenses + d.actual_expenses,
  }), { planned_income: 0, planned_expenses: 0, actual_income: 0, actual_expenses: 0 });

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 font-sans antialiased flex flex-col">
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
          <div className={`px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl text-sm font-medium flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
            toast.type === 'error' ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' :
            toast.type === 'warning' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
            'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
          }`}>
            <span className="flex-1">{toast.msg}</span>
            <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm mx-0 sm:mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="text-sm font-bold text-white mb-4">Impostazioni</h3>
            <label className="text-[10px] text-slate-500 font-semibold uppercase">Indirizzo Backend</label>
            <input type="text" value={settingsUrl} onChange={e => setSettingsUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/50 rounded-xl px-3 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/50 mt-1 mb-2 font-mono" />
            <p className="text-[10px] text-slate-600 mb-5">IP del Mac che esegue il backend</p>
            <button onClick={() => { localStorage.setItem('devfinance_api_url', settingsUrl); setShowSettings(false); window.location.reload(); }}
              className="w-full bg-cyan-500/15 text-cyan-400 font-bold text-sm py-3 rounded-xl border border-cyan-500/30 active:bg-cyan-500/25 transition-all mb-2">Salva e ricarica</button>
            <button onClick={() => setShowSettings(false)}
              className="w-full bg-slate-800 text-slate-400 font-bold text-sm py-3 rounded-xl border border-slate-700/50 active:bg-slate-700 transition-all">Annulla</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm mx-0 sm:mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="text-sm font-bold text-white mb-4">Nuovo movimento</h3>
            <form onSubmit={addManualHandler} className="space-y-3">
              <div className="flex gap-1 bg-slate-950/40 rounded-xl p-0.5 border border-slate-800/30">
                {['spesa', 'entrata'].map(t => (
                  <button key={t} type="button" onClick={() => setMType(t)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mType === t ? (t === 'spesa' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300') : 'text-slate-600'}`}>
                    {t === 'spesa' ? '− Spesa' : '+ Entrata'}
                  </button>
                ))}
              </div>
              <input type="date" value={mDate} onChange={e => setMDate(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800/50 rounded-xl px-3 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/50" />
              <input type="text" placeholder="Descrizione" value={mDesc} onChange={e => setMDesc(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800/50 rounded-xl px-3 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/50 placeholder:text-slate-600" />
              <div className="flex gap-2">
                <select value={mCat} onChange={e => setMCat(e.target.value)}
                  className="flex-1 bg-slate-950/60 border border-slate-800/50 rounded-xl px-3 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/50">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" step="0.01" placeholder="€" value={mAmount} onChange={e => setMAmount(e.target.value)}
                  className="w-24 bg-slate-950/60 border border-slate-800/50 rounded-xl px-3 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/50 placeholder:text-slate-600 text-right" />
              </div>
              <button type="submit"
                className="w-full bg-cyan-500/15 text-cyan-400 font-bold text-sm py-3 rounded-xl border border-cyan-500/30 active:bg-cyan-500/25 transition-all">+ Aggiungi</button>
            </form>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-lg mx-auto px-4 pt-4">

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/15">DF</div>
              <div>
                <h1 className="text-sm font-black text-white">DevFinance</h1>
                <p className="text-[9px] text-slate-600">{MONTH_FULL[month] || month}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <select value={month} onChange={e => setMonth(e.target.value)}
                className="bg-slate-900 border border-slate-700/50 rounded-xl px-2.5 py-2 text-[10px] text-slate-200 outline-none focus:border-cyan-500">
                {MONTHS.map(m => <option key={m} value={m}>{m.replace('-', ' ')}</option>)}
              </select>
              <button onClick={() => { setSettingsUrl(apiBase()); setShowSettings(true); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700/50 text-slate-500 active:bg-slate-800 text-base">⚙</button>
              <button onClick={() => setShowMenu(!showMenu)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700/50 text-slate-500 active:bg-slate-800 text-lg relative">☰</button>
            </div>
          </div>

          {showMenu && (
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-3 mb-4 shadow-xl">
              <label className="flex items-center gap-3 px-3 py-3 rounded-xl active:bg-slate-800 cursor-pointer">
                <span className="text-base">📄</span>
                <span className="text-xs text-slate-300 flex-1">{fineco ? fineco.name : 'Fineco (.xlsx)'}</span>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { setFineco(e.target.files[0]); }} />
                {fineco && <span className="text-emerald-400 text-sm">✓</span>}
              </label>
              <label className="flex items-center gap-3 px-3 py-3 rounded-xl active:bg-slate-800 cursor-pointer">
                <span className="text-base">💳</span>
                <span className="text-xs text-slate-300 flex-1">{revolut ? revolut.name : 'Revolut (.csv)'}</span>
                <input type="file" accept=".csv" className="hidden" onChange={e => { setRevolut(e.target.files[0]); }} />
                {revolut && <span className="text-emerald-400 text-sm">✓</span>}
              </label>
              <button onClick={() => { handleIngest(); setShowMenu(false); }} disabled={!fineco || !revolut}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-r from-cyan-500/15 to-emerald-500/15 text-cyan-400 font-bold text-xs mt-1 border border-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
                ⚡ Importa file
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 mb-4 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl px-4 py-3">
              <div className="animate-spin w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
              <span className="text-cyan-400 text-xs font-medium">Aggiornamento...</span>
            </div>
          )}

          <div className={`transition-all duration-300 ${loading ? 'opacity-30' : ''}`}>
            {tab === 'budget' && (
              <BudgetView {...{month, budgetDays, budgetTotals, saveForecast, deleteForecast, categories, budgetAverages, budgetAllocations, saveAllocations, transactions}} />
            )}

            {tab === 'etf' && <EtfView />}

            {tab === 'dashboard' && (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <MetricBox label="Entrate" value={income} color="text-emerald-300" active={activeMetric === 'income'} onClick={() => handleMetricClick('income')} />
                  <MetricBox label="Spese" value={expenses} color="text-rose-300" active={activeMetric === 'expenses'} onClick={() => handleMetricClick('expenses')} />
                  <MetricBox label="Risparmio" value={savings} color={savings >= 0 ? 'text-cyan-300' : 'text-rose-400'} active={activeMetric === 'savings'} onClick={() => handleMetricClick('savings')} />
                  <MetricBox label="Investito" value={invested} color="text-violet-300" active={activeMetric === 'invested'} onClick={() => handleMetricClick('invested')} />
                  <MetricBox label="Disponibile" value={investable} color={investable >= 0 ? 'text-teal-300' : 'text-rose-400'} active={activeMetric === 'investable'} onClick={() => handleMetricClick('investable')} />
                </div>

                {(activeMetric || selectedCategory) && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-cyan-500/5 border border-cyan-500/10 rounded-xl text-[10px]">
                    <span className="text-cyan-400 font-semibold">
                      {selectedCategory && `Categoria: ${selectedCategory}`}
                      {activeMetric === 'income' && 'Solo entrate'}
                      {activeMetric === 'expenses' && 'Solo spese'}
                      {activeMetric === 'savings' && 'Entrate / Uscite'}
                      {activeMetric === 'invested' && 'Solo investimenti'}
                      {activeMetric === 'investable' && 'Disponibile'}
                    </span>
                    <span className="text-slate-600">· {filteredTx.length}</span>
                    <button onClick={() => { setSelectedCategory(null); setActiveMetric(null); }} className="ml-auto text-slate-500 active:text-slate-300 font-bold">✕ Cancella</button>
                  </div>
                )}

                <div className="space-y-3 mb-3">
                  <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/50 rounded-2xl p-4">
                    <h3 className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Spese per categoria</h3>
                    {categories.length === 0 ? (
                      <p className="text-slate-600 text-xs py-4 text-center">Nessuna spesa</p>
                    ) : (
                      <div className="space-y-2.5">
                        {categories.map(c => {
                          const pct = totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0;
                          return (
                            <div key={c.name} onClick={() => { setSelectedCategory(c.name); setActiveMetric(null); if (ledgerRef.current) setTimeout(() => ledgerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} className="cursor-pointer active:scale-[0.99] transition-all">
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor(c.name) }} />
                                  <span className="text-[11px] text-slate-400 truncate">{c.name}</span>
                                </div>
                                <span className="text-[11px] font-mono text-slate-200 flex-shrink-0 ml-2">{c.amount.toFixed(0)}€</span>
                              </div>
                              <div className="w-full h-1 bg-slate-800/60 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: catColor(c.name) }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-800/30 flex justify-between text-[11px]">
                      <span className="text-slate-500">Trasferimenti</span>
                      <span className="font-mono text-slate-400">{transfers.toFixed(0)}€</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <SummaryCard label="Risparmio" value={savings} pct={income > 0 ? (savings / income) * 100 : 0} color={savings >= 0 ? 'emerald' : 'rose'} />
                    <SummaryCard label="Investibile" value={investable} pct={savings > 0 ? (investable / savings) * 100 : 0} color={investable >= 0 ? 'teal' : 'rose'} />
                    <SummaryCard label="Investito" value={invested} pct={income > 0 ? (invested / income) * 100 : 0} color="violet" />
                    <SummaryCard label="Trasferimenti" value={transfers} pct={income > 0 ? (transfers / income) * 100 : 0} color="slate" />
                  </div>
                </div>

                <div ref={ledgerRef} className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex gap-1 bg-slate-950/50 rounded-lg p-0.5 border border-slate-800/30">
                      {[
                        { key: 'all', label: 'Tutte' },
                        { key: 'expense', label: 'Uscite' },
                        { key: 'income', label: 'Entrate' },
                      ].map(f => (
                        <button key={f.key} onClick={() => { setFilter(f.key); setActiveMetric(null); }}
                          className={`px-2.5 py-1.5 rounded-md text-[9px] font-semibold transition-all min-w-[44px] ${filter === f.key && !activeMetric ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-500'}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative flex-1 max-w-[160px]">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[11px]">🔍</span>
                      <input type="text" placeholder="Cerca..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800/50 rounded-lg pl-7 pr-2.5 py-2 text-[10px] text-slate-200 outline-none focus:border-cyan-500/50 placeholder:text-slate-600" />
                    </div>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {filteredTx.length === 0 ? (
                      <div className="text-center py-10 text-slate-600 text-xs">
                        {search ? 'Nessuna transazione trovata' : 'Nessuna transazione'}
                      </div>
                    ) : (
                      sortedDates.map(date => {
                        const d = new Date(date + 'T12:00:00');
                        const dayLabel = DAYS[d.getDay()];
                        const txns = groups[date];
                        return (
                          <div key={date}>
                            <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm flex items-center gap-2 px-1 py-1.5 mt-2 first:mt-0">
                              <span className="text-[11px] font-bold text-slate-400">{date.replace(/-/g, '/')}</span>
                              <span className="text-[8px] text-slate-600 font-medium">{dayLabel}</span>
                              <span className="text-[8px] text-slate-700">{txns.length}</span>
                              <div className="flex-1 border-t border-slate-800/30" />
                            </div>
                            {txns.map((t, i) => {
                              const isExpense = t.amount < 0;
                              const isTransfer = t.macro_category === 'Trasferimento Interno';
                              const isInvestment = t.macro_category === 'Investimenti';
                              const dotColor = isTransfer ? '#64748b' : isInvestment ? '#2dd4bf' : isExpense ? '#fb7185' : '#4ade80';
                              const srcBadge = t.source === 'Fineco' ? 'bg-indigo-500/10 text-indigo-400' : t.source === 'Manuale' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-orange-500/10 text-orange-400';
                              return (
                                <div key={t.hash_id || i}
                                  className="flex items-center gap-2 bg-slate-950/20 rounded-xl px-2.5 py-2.5 border border-transparent active:bg-slate-950/40 transition-all min-h-[44px]">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${srcBadge}`}>{t.source === 'Manuale' ? 'Man' : t.source === 'Fineco' ? 'Fin' : 'Rev'}</span>
                                  <input type="text" defaultValue={t.description}
                                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.description) updDesc(t, v); }}
                                    className="flex-1 min-w-0 bg-transparent text-[11px] text-slate-300 truncate outline-none focus:text-cyan-300" />
                                  <select value={t.micro_category || 'Altro'} onChange={e => updCat(t, e.target.value)}
                                    className="bg-slate-950/60 text-slate-500 border border-slate-800/30 rounded-lg px-1.5 py-1 text-[8px] font-medium outline-none focus:border-cyan-500/50 max-w-[90px]">
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  <span className={`text-[11px] font-bold font-mono text-right flex-shrink-0 ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {isExpense ? '−' : '+'}{Math.abs(t.amount).toFixed(2)}
                                  </span>
                                  {t.source === 'Manuale' && (
                                    <button onClick={() => delManual(t.hash_id)}
                                      className="text-slate-600 active:text-rose-400 text-[11px] flex-shrink-0 ml-0.5">✕</button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/50 z-40">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-around py-1.5">
            <button onClick={() => setTab('dashboard')}
              className={`flex flex-col items-center gap-0.5 px-6 py-2 rounded-xl transition-all ${tab === 'dashboard' ? 'text-cyan-400' : 'text-slate-600'}`}>
              <span className="text-lg">📊</span>
              <span className="text-[9px] font-bold">Dashboard</span>
            </button>
            <button onClick={() => setTab('budget')}
              className={`flex flex-col items-center gap-0.5 px-6 py-2 rounded-xl transition-all ${tab === 'budget' ? 'text-cyan-400' : 'text-slate-600'}`}>
              <span className="text-lg">📅</span>
              <span className="text-[9px] font-bold">Budget</span>
            </button>
            <button onClick={() => setTab('etf')}
              className={`flex flex-col items-center gap-0.5 px-6 py-2 rounded-xl transition-all ${tab === 'etf' ? 'text-cyan-400' : 'text-slate-600'}`}>
              <span className="text-lg">📈</span>
              <span className="text-[9px] font-bold">ETF</span>
            </button>
            <button onClick={() => setShowForm(true)}
              className="flex flex-col items-center gap-0.5 px-6 py-2 rounded-xl text-emerald-400">
              <span className="text-lg w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">+</span>
              <span className="text-[9px] font-bold">Aggiungi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
