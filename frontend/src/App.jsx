import { useCallback, useRef, useState } from 'react';
import { api } from './api';
import { CATEGORIES, monthFull } from './constants';
import { useFinance } from './hooks/useFinance';

import DashboardView from './components/DashboardView';
import StatsView from './components/StatsView';
import BudgetView from './components/BudgetView';
import EtfView from './components/EtfView';
import PlanView from './components/plan/PlanView';
import SettingsModal from './components/SettingsModal';
import Modal from './components/Modal';
import TransactionRow from './components/TransactionRow';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'plan', label: 'Piano', icon: '🗓️' },
  { id: 'stats', label: 'Analisi', icon: '📈' },
  { id: 'budget', label: 'Budget', icon: '🎯' },
  { id: 'etf', label: 'Investimenti', icon: '💰' },
];

const EMPTY_MANUAL_FORM = {
  amount: '',
  description: '',
  micro_category: '',
  type: 'spesa',
  date: '',
};

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
  const [showSettings, setShowSettings] = useState(false);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerType, setLedgerType] = useState('all');
  const [ledgerLimit, setLedgerLimit] = useState(50);
  const [ledgerRows, setLedgerRows] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const finance = useFinance(month);
  const finecoRef = useRef(null);
  const revolutRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const askConfirm = useCallback((options) => setConfirmState(options), []);

  const fmtAmount = (value) => new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);

  const syncLedgerRow = (hashId, changes) => {
    setLedgerRows((rows) => (
      rows
        ? rows.map((row) => (row.hash_id === hashId ? { ...row, ...changes } : row))
        : rows
    ));
  };

  const handleUpdateDescription = async (tx, value) => {
    const result = await finance.updDesc(tx, value);
    if (result.ok) syncLedgerRow(tx.hash_id, { description: value });
    return result;
  };

  const handleUpdateCategory = async (tx, value) => {
    const result = await finance.updCat(tx, value);
    if (result.ok) syncLedgerRow(tx.hash_id, { micro_category: value });
    return result;
  };

  const handleUpdateAmount = async (tx, value) => {
    const result = await finance.updAmount(tx, value);
    if (result.ok) syncLedgerRow(tx.hash_id, { amount: tx.amount < 0 ? -Math.abs(value) : Math.abs(value) });
    return result;
  };

  const handleDeleteTransaction = (tx) => {
    if (!tx?.hash_id) return;
    askConfirm({
      title: 'Elimina transazione',
      message: `Vuoi eliminare definitivamente «${tx.description}» del ${tx.date} (${fmtAmount(tx.amount)})?`,
      confirmLabel: 'Elimina',
      danger: true,
      onConfirm: async () => {
        const result = await finance.delTransaction(tx);
        if (!result.ok) {
          showToast(result.error || 'Errore eliminazione', 'error');
          return;
        }
        setLedgerRows((rows) => (
          rows ? rows.filter((row) => row.hash_id !== tx.hash_id) : rows
        ));
        showToast('Transazione eliminata');
      },
    });
  };

  const handleDataChanged = async () => {
    await finance.refresh(month);
    if (ledgerRows) {
      try {
        const result = await api.transactions({ limit: 5000 });
        setLedgerRows(result.transactions || []);
      } catch {
        // Il registro si riallinea al prossimo apertura.
      }
    }
  };

  const transactions = finance.data?.transactions || [];
  const categories = finance.data?.categories || [];

  const handleIngest = async () => {
    const fineco = finecoRef.current?.files?.[0] || null;
    const revolut = revolutRef.current?.files?.[0] || null;
    if (!fineco && !revolut) {
      showToast('Seleziona almeno un file', 'error');
      return;
    }

    const result = await finance.ingest(fineco, revolut);
    if (!result.ok) {
      showToast(result.error || 'Errore importazione', 'error');
      return;
    }

    setShowIngest(false);
    if (finecoRef.current) finecoRef.current.value = '';
    if (revolutRef.current) revolutRef.current.value = '';
    showToast(`${result.records_added} transazioni importate`);
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    const result = await finance.addManual({
      amount: parseFloat(manualForm.amount),
      description: manualForm.description,
      micro_category: manualForm.micro_category || manualForm.description,
      type: manualForm.type,
      date: manualForm.date || new Date().toISOString().slice(0, 10),
    });
    if (!result.ok) {
      showToast(result.error || 'Errore', 'error');
      return;
    }
    setShowManual(false);
    setManualForm(EMPTY_MANUAL_FORM);
    showToast('Transazione aggiunta');
  };

  const handleSetBudget = async (categoryName, amount) => {
    const updated = { ...(finance.budgetAllocations || {}), [categoryName]: amount };
    const result = await finance.saveAllocations(updated);
    if (!result.ok) {
      showToast(result.error || 'Errore budget', 'error');
      return;
    }
    showToast(`Budget ${categoryName} aggiornato`);
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    const result = await finance.generatePlan();
    setGenerating(false);
    if (!result.ok) {
      showToast(result.error || 'Errore generazione piano', 'error');
      return;
    }
    showToast(
      result.days_skipped_manual > 0
        ? `Piano generato: ${result.days_written} giorni, ${result.days_skipped_manual} righe manuali intatte`
        : `Piano generato: ${result.days_written} giorni`,
    );
  };

  const openLedger = async () => {
    setShowLedger(true);
    try {
      const result = await api.transactions({ limit: 5000 });
      setLedgerRows(result.transactions || []);
    } catch (exc) {
      showToast(exc.message, 'error');
      setLedgerRows(transactions);
    }
  };

  const handleMakeRule = async (tx) => {    try {
      const result = await api.ruleFromTransaction({
        hash_id: tx.hash_id,
        micro_category: tx.micro_category,
        apply_existing: true,
      });
      showToast(
        result.updated_transactions > 0
          ? `Regola «${result.pattern}» salvata: ${result.updated_transactions} transazioni aggiornate`
          : `Regola «${result.pattern}» salvata`,
      );
      await finance.refresh(month);
    } catch (exc) {
      showToast(exc.message, 'error');
    }
  };

  const shiftMonth = (delta) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const date = new Date(year, monthNumber - 1 + delta, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    setSelectedCategory(null);
  };

  const vividPalette = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#a855f7', '#f472b6'];
  const catColorMap = {};
  const macroCategories = [...new Set(transactions.filter((t) => t.amount < 0).map((t) => t.macro_category))];
  macroCategories.forEach((category, index) => {
    catColorMap[category] = vividPalette[index % vividPalette.length];
  });
  const catColor = (name) => catColorMap[name] || '#94a3b8';

  const filteredTransactions = selectedCategory
    ? transactions.filter((t) => t.macro_category === selectedCategory)
    : transactions;

  // Nel registro unisco le righe fresche del mese visualizzato (così le
  // modifiche si vedono subito) con lo storico caricato all'apertura.
  const freshIds = new Set(transactions.map((tx) => tx.hash_id));
  const ledgerSource = (ledgerRows
    ? [...transactions, ...ledgerRows.filter((tx) => !freshIds.has(tx.hash_id))]
    : transactions
  ).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const ledgerQuery = ledgerSearch.trim().toLowerCase();
  const ledgerTransactions = ledgerSource.filter((tx) => {
    if (ledgerType === 'expense' && tx.amount >= 0) return false;
    if (ledgerType === 'income' && tx.amount <= 0) return false;
    if (!ledgerQuery) return true;
    return (tx.description || '').toLowerCase().includes(ledgerQuery)
      || (tx.micro_category || '').toLowerCase().includes(ledgerQuery)
      || (tx.macro_category || '').toLowerCase().includes(ledgerQuery);
  });

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 pb-24">
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl text-sm font-bold shadow-lg backdrop-blur-sm transition-all ${
          toast.type === 'error' ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'
        }`}>
          {toast.message}
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
              <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-lg transition-all" title="Impostazioni">
                ⚙️
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-all">←</button>
            <div className="text-center min-w-[160px]">
              <p className="text-base font-bold text-slate-100">{monthFull(month)}</p>
            </div>
            <button onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-all">→</button>
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
            {finance.error && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                <span className="text-sm text-rose-300 flex-1">{finance.error}</span>
                <button
                  onClick={() => finance.refresh(month)}
                  className="text-xs font-bold text-rose-200 hover:text-white transition-colors"
                >
                  Riprova
                </button>
              </div>
            )}

            {!finance.loading
              && finance.meta?.latest_month
              && month > finance.meta.latest_month
              && transactions.length === 0 && (
                <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs font-bold text-slate-200">
                    Nessun movimento a {monthFull(month)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    L'ultimo dato disponibile è {finance.meta.last_date}.
                  </p>
                  <button
                    onClick={() => setMonth(finance.meta.latest_month)}
                    className="mt-2 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Vai a {monthFull(finance.meta.latest_month)} →
                  </button>
                </div>
              )}

            {tab === 'dashboard' && (
              <DashboardView
                data={finance.data}
                categories={categories}
                transactions={filteredTransactions}
                catColor={catColor}
                onSelectCategory={setSelectedCategory}
                selectedCategory={selectedCategory}
                onOpenLedger={openLedger}
                onUpdateDescription={handleUpdateDescription}
                onUpdateCategory={handleUpdateCategory}
                onUpdateAmount={handleUpdateAmount}
                onDelete={handleDeleteTransaction}
              />
            )}
            {tab === 'plan' && (
              <PlanView
                plan={finance.plan}
                projection={finance.projection}
                month={month}
                onGenerate={handleGeneratePlan}
                onSaveForecast={finance.saveForecast}
                onDeleteForecast={finance.deleteForecast}
                onLoadProjection={finance.loadProjection}
                generating={generating}
              />
            )}
            {tab === 'stats' && <StatsView />}
            {tab === 'budget' && (
              <BudgetView
                categories={categories}
                budgets={finance.budgetAllocations}
                averages={finance.budgetAverages}
                onSetBudget={handleSetBudget}
              />
            )}
            {tab === 'etf' && <EtfView />}
          </>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 bg-[#0a0f1e]/90 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-lg mx-auto flex">
          {TABS.map((t) => (
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
          <p className="text-xs text-slate-500">Puoi caricare anche un solo file.</p>
          <button onClick={handleIngest} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98]">
            Importa
          </button>
        </div>
      </Modal>

      <Modal open={showManual} onClose={() => setShowManual(false)} title="Aggiungi transazione">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Importo (€)</label>
            <input type="number" step="0.01" required value={manualForm.amount} onChange={(e) => setManualForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Descrizione</label>
            <input type="text" required value={manualForm.description} onChange={(e) => setManualForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tipo</label>
              <select value={manualForm.type} onChange={(e) => setManualForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors">
                <option value="spesa">Spesa</option>
                <option value="entrata">Entrata</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Sottocategoria</label>
              <select value={manualForm.micro_category} onChange={(e) => setManualForm((f) => ({ ...f, micro_category: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors">
                <option value="">— seleziona —</option>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Data</label>
            <input type="date" value={manualForm.date} onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98]">
            Aggiungi
          </button>
        </form>
      </Modal>

      <Modal open={showLedger} onClose={() => setShowLedger(false)} title="Transazioni">
        <div className="space-y-3">
          <input
            type="search"
            value={ledgerSearch}
            onChange={(event) => { setLedgerSearch(event.target.value); setLedgerLimit(50); }}
            placeholder="Cerca descrizione o categoria..."
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
          />

          <div className="flex gap-1.5">
            {[
              { id: 'all', label: 'Tutte' },
              { id: 'expense', label: 'Spese' },
              { id: 'income', label: 'Entrate' },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => { setLedgerType(option.id); setLedgerLimit(50); }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  ledgerType === option.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-500">
            {ledgerTransactions.length} transazioni
            {ledgerRows ? ' · tutto lo storico' : ''}
          </p>
          <p className="text-[10px] text-slate-600">
            Tocca descrizione, categoria o importo per modificare · ✕ per eliminare
          </p>

          {ledgerTransactions.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">Nessuna transazione</p>
          ) : (
            <div className="space-y-1 max-h-[55vh] overflow-y-auto">
              {ledgerTransactions.slice(0, ledgerLimit).map((tx, index) => (
                <TransactionRow
                  key={tx.hash_id || index}
                  tx={tx}
                  showDate
                  onUpdateDescription={handleUpdateDescription}
                  onUpdateCategory={handleUpdateCategory}
                  onUpdateAmount={handleUpdateAmount}
                  onDelete={handleDeleteTransaction}
                  onMakeRule={handleMakeRule}
                />
              ))}
            </div>
          )}

          {ledgerTransactions.length > ledgerLimit && (
            <button
              onClick={() => setLedgerLimit((value) => value + 50)}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-colors"
            >
              Carica altre 50
            </button>
          )}
        </div>
      </Modal>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        showToast={showToast}
        askConfirm={askConfirm}
        onDataChanged={handleDataChanged}
      />

      <Modal
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        title={confirmState?.title || 'Conferma'}
      >
        <p className="text-sm text-slate-300">{confirmState?.message}</p>
        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setConfirmState(null)}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-300 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={async () => {
              const current = confirmState;
              setConfirmState(null);
              await current?.onConfirm?.();
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${
              confirmState?.danger
                ? 'bg-rose-500 hover:bg-rose-400'
                : 'bg-cyan-500 hover:bg-cyan-400'
            }`}
          >
            {confirmState?.confirmLabel || 'Conferma'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
