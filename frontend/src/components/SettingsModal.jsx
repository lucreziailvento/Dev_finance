import { useCallback, useEffect, useState } from 'react';
import { api, apiBase } from '../api';
import { CATEGORIES } from '../constants';
import Modal from './Modal';

export default function SettingsModal({ open, onClose, showToast }) {
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [apiUrl, setApiUrl] = useState(apiBase());
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState('Spesa Alimentare');
  const [applyExisting, setApplyExisting] = useState(true);

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

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    api.rules()
      .then((value) => { if (active) setRules(value); })
      .catch((exc) => { if (active) showToast?.(exc.message, 'error'); })
      .finally(() => { if (active) setLoadingRules(false); });
    return () => { active = false; };
  }, [open, showToast]);

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
