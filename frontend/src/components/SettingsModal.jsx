import { useCallback, useEffect, useState } from 'react';
import { api, apiBase } from '../api';
import { CATEGORIES } from '../constants';
import Modal from './Modal';

export default function SettingsModal({ open, onClose, showToast, askConfirm, onDataChanged }) {
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [apiUrl, setApiUrl] = useState(apiBase());
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState('Spesa Alimentare');
  const [applyExisting, setApplyExisting] = useState(true);
  const [imports, setImports] = useState([]);
  const [sources, setSources] = useState([]);
  const [loadingImports, setLoadingImports] = useState(true);
  const [bulkSource, setBulkSource] = useState('');
  const [bulkFrom, setBulkFrom] = useState('');
  const [bulkTo, setBulkTo] = useState('');
  const [bulkCount, setBulkCount] = useState(null);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      setRules(await api.rules());
    } catch (exc) {
      showToast?.(exc.message, 'error');
    } finally {
      setLoadingRules(false);
    }
  }, [showToast]);

  const loadImports = useCallback(async () => {
    setLoadingImports(true);
    try {
      const [batchPayload, sourcePayload] = await Promise.all([api.imports(), api.sources()]);
      setImports(batchPayload?.imports || []);
      setSources(sourcePayload?.sources || []);
    } catch (exc) {
      showToast?.(exc.message, 'error');
    } finally {
      setLoadingImports(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    api.rules()
      .then((value) => { if (active) setRules(value); })
      .catch((exc) => { if (active) showToast?.(exc.message, 'error'); })
      .finally(() => { if (active) setLoadingRules(false); });
    return () => { active = false; };
  }, [open, showToast]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    Promise.all([api.imports(), api.sources()])
      .then(([batchPayload, sourcePayload]) => {
        if (!active) return;
        setImports(batchPayload?.imports || []);
        setSources(sourcePayload?.sources || []);
      })
      .catch((exc) => { if (active) showToast?.(exc.message, 'error'); })
      .finally(() => { if (active) setLoadingImports(false); });
    return () => { active = false; };
  }, [open, showToast]);

  // Anteprima della cancellazione massiva: nessun filtro = nessuna azione.
  useEffect(() => {
    if (!open) return undefined;
    if (!bulkSource && !bulkFrom && !bulkTo) return undefined;
    let active = true;
    api.transactions({
      source: bulkSource,
      date_from: bulkFrom,
      date_to: bulkTo,
      limit: 1,
    })
      .then((result) => { if (active) setBulkCount(result?.total ?? 0); })
      .catch(() => { if (active) setBulkCount(null); });
    return () => { active = false; };
  }, [open, bulkSource, bulkFrom, bulkTo]);

  const saveApiUrl = () => {
    const value = apiUrl.trim();
    try {
      if (value && value !== window.location.origin) localStorage.setItem('devfinance_api_url', value);
      else localStorage.removeItem('devfinance_api_url');
    } catch {
      // localStorage può essere disabilitato: ignoro e ricarico.
    }
    window.location.reload();
  };

  const addRule = async (event) => {
    event.preventDefault();
    try {
      const result = await api.createRule({
        pattern,
        micro_category: category,
        apply_existing: applyExisting,
      });
      showToast?.(
        result.updated_transactions > 0
          ? `Regola salvata, ${result.updated_transactions} transazioni aggiornate`
          : 'Regola salvata',
      );
      setPattern('');
      await loadRules();
    } catch (exc) {
      showToast?.(exc.message, 'error');
    }
  };

  const removeRule = async (rule) => {
    try {
      await api.deleteRule(rule.id);
      await loadRules();
      showToast?.('Regola eliminata');
    } catch (exc) {
      showToast?.(exc.message, 'error');
    }
  };

  const removeImport = (batch) => {
    const name = batch.filename || batch.source || `lotto ${batch.id}`;
    askConfirm?.({
      title: 'Annulla importazione',
      message: `Eliminare le ${batch.transactions_remaining} transazioni ancora presenti del file «${name}»? I movimenti manuali non saranno toccati.`,
      confirmLabel: 'Elimina',
      danger: true,
      onConfirm: async () => {
        try {
          const result = await api.deleteImport(batch.id);
          showToast?.(`Importazione annullata: ${result.deleted_transactions} transazioni eliminate`);
          await loadImports();
          await onDataChanged?.();
        } catch (exc) {
          showToast?.(exc.message, 'error');
        }
      },
    });
  };

  const deleteBulk = () => {
    if (!bulkSource && !bulkFrom && !bulkTo) {
      showToast?.('Indica almeno una fonte o un periodo', 'error');
      return;
    }
    const parts = [];
    if (bulkSource) parts.push(`fonte ${bulkSource}`);
    if (bulkFrom) parts.push(`dal ${bulkFrom}`);
    if (bulkTo) parts.push(`al ${bulkTo}`);
    askConfirm?.({
      title: 'Eliminazione massiva',
      message: `Eliminare ${bulkCount ?? 0} transazioni importate (${parts.join(', ')})? I movimenti manuali non saranno toccati.`,
      confirmLabel: 'Elimina',
      danger: true,
      onConfirm: async () => {
        try {
          const result = await api.deleteRange({
            source: bulkSource,
            date_from: bulkFrom,
            date_to: bulkTo,
          });
          showToast?.(`${result.deleted_transactions} transazioni eliminate`);
          setBulkCount(0);
          await loadImports();
          await onDataChanged?.();
        } catch (exc) {
          showToast?.(exc.message, 'error');
        }
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Impostazioni">
      <div className="space-y-6">
        <section>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Esporta dati</h3>
          <a
            href={api.exportTransactionsUrl()}
            className="block w-full text-center py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-200 transition-colors"
          >
            ⬇️ Scarica CSV delle transazioni
          </a>
          <p className="text-[11px] text-slate-500 mt-1.5">
            File compatibile con Excel italiano (separatore «;», accenti inclusi).
          </p>
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Importazioni</h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Annulla un singolo caricamento oppure elimina per fonte e periodo.
            Le transazioni manuali restano sempre intatte.
          </p>

          {loadingImports ? (
            <p className="text-xs text-slate-500">Caricamento importazioni...</p>
          ) : imports.length === 0 ? (
            <p className="text-xs text-slate-500 mb-3">
              Nessun caricamento registrato. Le importazioni fatte prima di questo
              aggiornamento non hanno un lotto: usa l&apos;eliminazione per fonte o periodo.
            </p>
          ) : (
            <div className="divide-y divide-white/5 mb-4">
              {imports.map((batch) => (
                <div key={batch.id} className="flex items-start gap-2 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 truncate">
                      {batch.filename || batch.source || `Lotto #${batch.id}`}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {batch.source || 'Senza fonte'} · {batch.records_added} importate
                      {batch.transactions_remaining !== batch.records_added
                        ? ` · ${batch.transactions_remaining} rimaste`
                        : ''}
                      {batch.first_date ? ` · ${batch.first_date} → ${batch.last_date}` : ''}
                      {batch.created_at ? ` · caricato ${batch.created_at.slice(0, 10)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeImport(batch)}
                    disabled={!batch.transactions_remaining}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-300 text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Annulla questa importazione"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-300">Elimina per fonte o periodo</p>
            <select
              value={bulkSource}
              onChange={(event) => { setBulkSource(event.target.value); setBulkCount(null); }}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              <option value="">Tutte le fonti importate</option>
              {sources.map((item) => (
                <option key={item.source} value={item.source}>
                  {item.source} ({item.transactions})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                value={bulkFrom}
                onChange={(event) => { setBulkFrom(event.target.value); setBulkCount(null); }}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="date"
                value={bulkTo}
                onChange={(event) => { setBulkTo(event.target.value); setBulkCount(null); }}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              {!bulkSource && !bulkFrom && !bulkTo
                ? 'Scegli una fonte o un periodo per vedere quante transazioni verranno eliminate.'
                : bulkCount === null
                  ? 'Conteggio in corso...'
                  : `${bulkCount} transazioni importate corrispondono ai filtri.`}
            </p>
            <button
              onClick={deleteBulk}
              disabled={bulkCount === null || (!bulkSource && !bulkFrom && !bulkTo) || bulkCount === 0}
              className="w-full py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Elimina transazioni selezionate
            </button>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Regole di categorizzazione</h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Quando una descrizione contiene la parola chiave, la categoria viene applicata
            automaticamente anche ai prossimi import.
          </p>

          <form onSubmit={addRule} className="space-y-2 mb-3">
            <input
              type="text"
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              placeholder="Parola chiave (es. conad)"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {CATEGORIES.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button
                type="submit"
                className="px-4 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black hover:bg-cyan-400 transition-colors"
              >
                Aggiungi
              </button>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-400">
              <input
                type="checkbox"
                checked={applyExisting}
                onChange={(event) => setApplyExisting(event.target.checked)}
                className="accent-cyan-500"
              />
              Applica anche alle transazioni già importate
            </label>
          </form>

          {loadingRules ? (
            <p className="text-xs text-slate-500">Caricamento regole...</p>
          ) : rules.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nessuna regola. Puoi crearne una anche dalla lista transazioni con il pulsante 🔁.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-2 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 truncate">«{rule.pattern}» → {rule.micro_category}</p>
                    <p className="text-[10px] text-slate-500">
                      {rule.macro_category} · {rule.matches} transazioni
                      {rule.source ? ` · solo ${rule.source}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeRule(rule)}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-300 text-xs transition-colors"
                    title="Elimina regola"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Connessione backend</h3>
          <input
            type="url"
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            placeholder="https://..."
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={saveApiUrl}
            className="mt-2 w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 transition-colors"
          >
            Salva indirizzo e ricarica
          </button>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Utile nell'app mobile per puntare al server locale.
          </p>
        </section>
      </div>
    </Modal>
  );
}
