import { useState, useCallback, useRef, useEffect } from 'react';
import { MONTH_FULL, COLORS, CATEGORIES } from './constants';
import { useFinance } from './hooks/useFinance';

import DashboardView from './components/DashboardView';
import StatsView from './components/StatsView';
import BudgetView from './components/BudgetView';
import EtfView from './components/EtfView';
import Modal from './components/Modal';

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

function InlineAmount({ amount, isManual, onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.abs(amount)));
  const ref = useRef(null);

  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);

  const fmtAmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

  const commit = () => {
    setEditing(false);
    const val = parseFloat(draft);
    if (!isNaN(val) && val > 0 && val !== Math.abs(amount)) onSave(val);
    else setDraft(String(Math.abs(amount)));
  };

  if (!isManual) {
    return <span className={`font-mono ${className}`}>{fmtAmt(amount)}</span>;
  }

  if (editing) {
    return (
      <input ref={ref} type="number" step="0.01" value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(Math.abs(amount))); setEditing(false); } }}
        className={`w-24 bg-slate-800 border border-cyan-500 rounded-lg px-2 py-0.5 text-sm text-right font-mono text-slate-100 focus:outline-none ${className}`} />
    );
  }

  return (
    <button onClick={() => { setDraft(String(Math.abs(amount))); setEditing(true); }}
      className={`font-mono hover:bg-white/5 rounded-lg px-1 transition-colors cursor-pointer ${className}`}>
      {fmtAmt(amount)}
    </button>
  );
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'stats', label: 'Analisi', icon: '📈' },
  { id: 'budget', label: 'Budget', icon: '🎯' },
  { id: 'etf', label: 'Investimenti', icon: '💰' },
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showIngest, setShowIngest] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showLedger, setShowLedger] = useState(false);
  const [toast, setToast] = useState(null);

  const finance = useFinance(month);
  const finecoRef = useRef(null);
  const revolutRef = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const categories = finance.data?.categories || [];
  const transactions = finance.data?.transactions || [];

  const handleIngest = async () => {
    const finecoFile = finecoRef.current?.files?.[0];
    const revolutFile = revolutRef.current?.files?.[0];
    if (!finecoFile && !revolutFile) return;

    const fd = new FormData();
    if (finecoFile) fd.append('fineco_file', finecoFile);
    if (revolutFile) fd.append('revolut_file', revolutFile);

    try {
      const r = await fetch('/api/ingest', { method: 'POST', body: fd });
      const data = await r.json();
      finance.refresh();
      setShowIngest(false);
      if (finecoRef.current) finecoRef.current.value = '';
      if (revolutRef.current) revolutRef.current.value = '';
      showToast(`${data.records_added || 0} transazioni importate`);
    } catch {
      showToast('Errore importazione', 'error');
    }
  };

  const [manualForm, setManualForm] = useState({ amount: '', description: '', micro_category: '', type: 'spesa', date: '' });

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/manual-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(manualForm.amount),
          description: manualForm.description,
          micro_category: manualForm.micro_category || manualForm.description,
          type: manualForm.type,
          date: manualForm.date || new Date().toISOString().slice(0, 10),
        }),
      });
      if (res.ok) {
        finance.refresh();
        setShowManual(false);
        setManualForm({ amount: '', description: '', micro_category: '', type: 'spesa', date: '' });
        showToast('Transazione aggiunta');
      }
    } catch {
      showToast('Errore', 'error');
    }
  };

  const handleSetBudget = async (catName, amount) => {
    const existing = finance.budgetAllocations || {};
    const updated = { ...existing, [catName]: amount };
    await finance.saveAllocations(updated);
    showToast(`Budget ${catName} aggiornato`);
  };

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const vividPalette = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#a855f7', '#f472b6'];
  const catColorMap = {};
  const macroCats = [...new Set(transactions.filter(t => t.amount < 0).map(t => t.macro_category))];
  macroCats.forEach((c, i) => { catColorMap[c] = vividPalette[i % vividPalette.length]; });
  const catColor = (name) => catColorMap[name] || '#94a3b8';

  const filteredTransactions = selectedCategory
    ? transactions.filter(t => t.macro_category === selectedCategory)
    : transactions;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 pb-24">
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl text-sm font-bold shadow-lg backdrop-blur-sm transition-all ${
          toast.type === 'error' ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="sticky top-0 z-40 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-black tracking-tight">
              <span className="text-cyan-400">Dev</span> <span className="text-slate-200">Finance</span>
            </h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowIngest(true)} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-lg transition-all" title="Importa">
                📥
              </button>
              <button onClick={() => setShowManual(true)} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-lg transition-all" title="Aggiungi">
                ✚
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-all">←</button>
            <div className="text-center min-w-[160px]">
              <p className="text-base font-bold text-slate-100">{MONTH_FULL[month] || month}</p>
            </div>
            <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-all">→</button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5">
        {finance.loading && !finance.data ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">Caricamento...</p>
          </div>
        ) : (
          <>
            {tab === 'dashboard' && (
              <DashboardView
                data={finance.data}
                categories={categories}
                transactions={filteredTransactions}
                catColor={catColor}
                onSelectCategory={setSelectedCategory}
                selectedCategory={selectedCategory}
                onOpenLedger={() => setShowLedger(true)}
                onUpdateDescription={(tx, val) => { finance.updDesc(tx, val); finance.refresh(); }}
                onUpdateCategory={(tx, val) => { finance.updCat(tx, val); finance.refresh(); }}
                onUpdateAmount={(tx, val) => { finance.updAmount(tx, val); finance.refresh(); }}
              />
            )}
            {tab === 'stats' && <StatsView />}
            {tab === 'budget' && (
              <BudgetView
                categories={categories}
                budgets={finance.budgetAllocations}
                onSetBudget={handleSetBudget}
              />
            )}
            {tab === 'etf' && <EtfView />}
          </>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 bg-[#0a0f1e]/90 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-lg mx-auto flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all ${
                tab === t.id ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-xl">{t.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span>
              {tab === t.id && <div className="w-8 h-0.5 bg-cyan-400 rounded-full mt-0.5" />}
            </button>
          ))}
        </div>
      </div>

      <Modal open={showIngest} onClose={() => setShowIngest(false)} title="Importa estratti conto">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Fineco (.xlsx)</label>
            <input ref={finecoRef} type="file" accept=".xlsx,.xls,.csv" className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 file:cursor-pointer" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Revolut (.csv)</label>
            <input ref={revolutRef} type="file" accept=".csv" className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-violet-500/20 file:text-violet-300 hover:file:bg-violet-500/30 file:cursor-pointer" />
          </div>
          <button onClick={handleIngest} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98]">
            Importa
          </button>
        </div>
      </Modal>

      <Modal open={showManual} onClose={() => setShowManual(false)} title="Aggiungi transazione">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Importo (€)</label>
            <input type="number" step="0.01" required value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Descrizione</label>
            <input type="text" required value={manualForm.description} onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tipo</label>
              <select value={manualForm.type} onChange={e => setManualForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors">
                <option value="spesa">Spesa</option>
                <option value="entrata">Entrata</option>
              </select>
            </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Sottocategoria</label>
            <select value={manualForm.micro_category} onChange={e => setManualForm(f => ({ ...f, micro_category: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors">
              <option value="">— seleziona —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Data</label>
            <input type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98]">
            Aggiungi
          </button>
        </form>
      </Modal>

      <Modal open={showLedger} onClose={() => setShowLedger(false)} title="Tutte le transazioni">
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {filteredTransactions.map((t, i) => {
            const isExpense = t.amount < 0;
            return (
              <div key={t.hash_id || i} className="flex items-center gap-3 py-2.5 px-1 rounded-xl hover:bg-white/5 transition-colors">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isExpense ? COLORS.expenses : COLORS.income }} />
                <div className="flex-1 min-w-0">
                  <InlineEdit value={t.description} onSave={v => { finance.updDesc(t, v); finance.refresh(); }} className="text-sm text-slate-200 truncate block w-full" />
                  <CategorySelect value={t.micro_category} onChange={v => { finance.updCat(t, v); finance.refresh(); }} className="text-xs text-slate-500" />
                </div>
                <div className="text-right">
                  <InlineAmount amount={t.amount} isManual={t.hash_id?.startsWith('manual_')} onSave={v => { finance.updAmount(t, v); finance.refresh(); }}
                    className={`text-sm font-bold ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`} />
                  <p className="text-[11px] text-slate-600">{t.date}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
