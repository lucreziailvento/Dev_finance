import { useState, useEffect, useCallback, useRef } from 'react';
import { CATEGORIES, MONTHS, MONTH_FULL } from './constants';

function API() { return localStorage.getItem('devfinance_api_url') || window.location.origin; }
const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

export default function App() {
  const [month, setMonth] = useState('2026-06');
  const [data, setData] = useState(null);
  const [fineco, setFineco] = useState(null);
  const [revolut, setRevolut] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('all');
  const [activeMetric, setActiveMetric] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [forecast, setForecast] = useState({ forecasts: [], actuals: {} });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsUrl, setSettingsUrl] = useState(API());
  const [showMenu, setShowMenu] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [budgetAverages, setBudgetAverages] = useState(null);
  const [budgetAllocations, setBudgetAllocations] = useState({});
  const ledgerRef = useRef(null);

  const [mType, setMType] = useState('spesa');
  const [mDate, setMDate] = useState('2026-06-01');
  const [mDesc, setMDesc] = useState('');
  const [mAmount, setMAmount] = useState('');
  const [mCat, setMCat] = useState('Spesa Alimentare');

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ id: Date.now(), msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchData = useCallback(async (m) => {
    setLoading(true);
    try {
      const r = await fetch(`${API()}/api/dashboard/${m}`);
      const j = await r.json();
      if (!j.error) setData(j);
      else showToast(j.error, 'error');
    } catch {
      showToast('Backend non raggiungibile', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  const fetchForecast = useCallback(async (m) => {
    try {
      const r = await fetch(`${API()}/api/forecast/${m}`);
      const j = await r.json();
      if (!j.error) setForecast(j);
    } catch {}
  }, []);

  const fetchBudgetAverages = useCallback(async () => {
    try {
      const r = await fetch(`${API()}/api/budget-averages`);
      const j = await r.json();
      if (!j.error) setBudgetAverages(j);
    } catch {}
  }, []);

  const fetchBudgetAllocations = useCallback(async (m) => {
    try {
      const r = await fetch(`${API()}/api/budget-allocations/${m}`);
      const j = await r.json();
      if (!j.error) setBudgetAllocations(j);
    } catch {}
  }, []);

  const saveAllocations = useCallback(async (allocations) => {
    try {
      await fetch(`${API()}/api/budget-allocations/${month}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocations),
      });
      fetchBudgetAverages();
      fetchBudgetAllocations(month);
    } catch {}
  }, [month, fetchBudgetAverages, fetchBudgetAllocations]);

  useEffect(() => { fetchData(month); fetchForecast(month); fetchBudgetAverages(); fetchBudgetAllocations(month); }, [month, fetchData, fetchForecast, fetchBudgetAverages, fetchBudgetAllocations]);

  const handleIngest = async () => {
    if (!fineco || !revolut) { showToast('Seleziona entrambi i file', 'warning'); return; }
    setLoading(true);
    const fd = new FormData();
    fd.append('fineco_file', fineco);
    fd.append('revolut_file', revolut);
    try {
      const r = await fetch(`${API()}/api/ingest`, { method: 'POST', body: fd });
      const j = await r.json();
      if (r.ok) {
        showToast(`${j.records_added} nuovi record`, 'success');
        setFineco(null); setRevolut(null);
        fetchData(month); fetchForecast(month);
      } else showToast(j.detail || 'Errore', 'error');
    } catch { showToast('Errore ingest', 'error'); }
    finally { setLoading(false); }
  };

  const addManual = async (e) => {
    e.preventDefault();
    if (!mDesc || !mAmount) return;
    try {
      await fetch(`${API()}/api/manual-records`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: mDate, description: mDesc, amount: parseFloat(mAmount), micro_category: mCat, type: mType }),
      });
      setMDesc(''); setMAmount(''); setShowForm(false);
      showToast('Movimento registrato', 'success');
      fetchData(month); fetchForecast(month);
    } catch { showToast('Errore', 'error'); }
  };

  const updDesc = async (hashId, val) => {
    if (hashId.startsWith('manual_')) {
      const id = hashId.replace('manual_', '');
      const t = transactions.find(tx => tx.hash_id === hashId);
      if (!t) return;
      await fetch(`${API()}/api/manual-records/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: t.date, description: val, amount: Math.abs(t.amount), micro_category: t.micro_category, type: t.amount > 0 ? 'entrata' : 'spesa' }),
      });
    } else {
      await fetch(`${API()}/api/transactions/update-description`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash_id: hashId, new_description: val }),
      });
    }
    fetchData(month);
  };

  const updCat = async (hashId, val) => {
    if (hashId.startsWith('manual_')) {
      const id = hashId.replace('manual_', '');
      const t = transactions.find(tx => tx.hash_id === hashId);
      if (!t) return;
      await fetch(`${API()}/api/manual-records/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: t.date, description: t.description, amount: Math.abs(t.amount), micro_category: val, type: t.amount > 0 ? 'entrata' : 'spesa' }),
      });
    } else {
      await fetch(`${API()}/api/transactions/update-category`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash_id: hashId, new_micro_category: val }),
      });
    }
    fetchData(month);
  };

  const delManual = async (hashId) => {
    if (!hashId.startsWith('manual_')) return;
    await fetch(`${API()}/api/manual-records/${hashId.replace('manual_', '')}`, { method: 'DELETE' });
    fetchData(month); fetchForecast(month);
  };

  const saveForecast = async (date, pi, pe, notes) => {
    await fetch(`${API()}/api/forecast`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, planned_income: pi, planned_expenses: pe, notes }),
    });
    fetchForecast(month);
  };

  const deleteForecast = async (date) => {
    await fetch(`${API()}/api/forecast/${date}`, { method: 'DELETE' });
    fetchForecast(month);
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

      {/* ── Settings modal ── */}
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

      {/* ── Manual form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm mx-0 sm:mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="text-sm font-bold text-white mb-4">Nuovo movimento</h3>
            <form onSubmit={addManual} className="space-y-3">
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

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-lg mx-auto px-4 pt-4">

          {/* ── Top bar ── */}
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
              <button onClick={() => { setSettingsUrl(API()); setShowSettings(true); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700/50 text-slate-500 active:bg-slate-800 text-base">⚙</button>
              <button onClick={() => setShowMenu(!showMenu)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700/50 text-slate-500 active:bg-slate-800 text-lg relative">☰</button>
            </div>
          </div>

          {/* ── Menu dropdown ── */}
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

            {tab === 'budget' ? (
              <BudgetView {...{month, budgetDays, budgetTotals, saveForecast, deleteForecast, showToast, transactions, categories, catColor, budgetAverages, budgetAllocations, saveAllocations}} />
            ) : (
              <>
                {/* ── Metric boxes ── */}
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

                {/* ── Categories + Summary ── */}
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

                {/* ── Ledger ── */}
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
                                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.description) updDesc(t.hash_id, v); }}
                                    className="flex-1 min-w-0 bg-transparent text-[11px] text-slate-300 truncate outline-none focus:text-cyan-300" />
                                  <select value={t.micro_category || 'Altro'} onChange={e => updCat(t.hash_id, e.target.value)}
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

      {/* ── Bottom navigation ── */}
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

// ── BUDGET VIEW ──

function BudgetView({ month, budgetDays, budgetTotals, saveForecast, deleteForecast, categories, catColor, budgetAverages, budgetAllocations, saveAllocations, transactions }) {
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

  // Merge averages, allocations, and current spending
  const currSpending = {};
  const expenseTx = transactions.filter(t => t.amount < 0 && t.macro_category !== 'Trasferimento Interno' && t.macro_category !== 'Investimenti');
  expenseTx.forEach(t => { currSpending[t.micro_category] = (currSpending[t.micro_category] || 0) + Math.abs(t.amount); });

  const allCatNames = [...new Set([...categoryAverages.map(c => c.name), ...categories.map(c => c.name), ...Object.keys(budgetAllocations)])].sort();
  const allocs = localAllocs || { ...budgetAllocations };
  const totalBudget = Object.values(allocs).reduce((s, v) => s + v, 0);
  const totalSpent = Object.values(currSpending).reduce((s, v) => s + v, 0);

  // Compute suggested allocation based on medians
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

      {/* ── Monthly averages banner ── */}
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

      {/* ── Category budget allocation ── */}
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
        {/* Total bar */}
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

      {/* ── Day-by-day forecast ── */}
      {showDays && (
        <>
          {/* ── Top summary chips ── */}
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

          {/* ── Total bar ── */}
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

// ── COMPONENTS ──

function MetricBox({ label, value, color, active, onClick }) {
  return (
    <div onClick={onClick}
      className={`rounded-2xl p-3.5 cursor-pointer transition-all active:scale-[0.97] border ${
        active ? 'border-cyan-500/50 bg-cyan-500/5 shadow-lg shadow-cyan-500/5' : 'border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-900/40'
      }`}>
      <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-black mt-0.5 ${color}`}>{value.toFixed(2)}</p>
      <p className="text-[8px] text-slate-600">EUR</p>
    </div>
  );
}

function SummaryCard({ label, value, pct, color }) {
  const colors = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', bar: 'bg-emerald-500', border: 'border-emerald-500/20' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-300', bar: 'bg-rose-500', border: 'border-rose-500/20' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-300', bar: 'bg-teal-500', border: 'border-teal-500/20' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-300', bar: 'bg-violet-500', border: 'border-violet-500/20' },
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-300', bar: 'bg-slate-500', border: 'border-slate-500/20' },
  };
  const s = colors[color] || colors.slate;
  return (
    <div className={`${s.bg} ${s.border} border rounded-2xl p-3`}>
      <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-black mt-0.5 ${s.text}`}>{value.toFixed(2)} €</p>
      <div className="mt-1.5 w-full h-1 bg-slate-800/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
      </div>
    </div>
  );
}

function BudgetChip({ label, value, color, bg }) {
  return (
    <div className={`${bg} border border-slate-800/30 rounded-xl p-2.5`}>
      <p className="text-[7px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}

function catColor(name) {
  const colors = {
    "Spesa Alimentare": "#34d399", "Affitto & Condominio": "#a78bfa",
    "Utenze & Bollette": "#38bdf8", "Svago & Ristorazione": "#fbbf24",
    "Sport & Salute": "#fb7185", "Shopping & Lifestyle": "#e879f9",
    "Abbonamenti Digitali": "#22d3ee", "Trasporti & Viaggi": "#fb923c",
    "Investimenti & Risparmio": "#2dd4bf", "Entrate_Lavoro": "#4ade80",
    "Altre Entrate": "#a3e635", "Giroconto": "#64748b", "Altro": "#94a3b8",
  };
  return colors[name] || "#64748b";
}
