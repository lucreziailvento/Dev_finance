import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

const isManual = (tx) => Boolean(tx?.hash_id?.startsWith('manual_'));
const manualId = (tx) => tx.hash_id.replace('manual_', '');

function manualPayload(tx, overrides = {}) {
  return {
    date: tx.date,
    description: tx.description,
    amount: Math.abs(tx.amount),
    micro_category: tx.micro_category,
    type: tx.amount > 0 ? 'entrata' : 'spesa',
    ...overrides,
  };
}

export function useFinance(month) {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState({ forecasts: [], actuals: {} });
  const [budgetAverages, setBudgetAverages] = useState(null);
  const [budgetAllocations, setBudgetAllocations] = useState({});
  const [plan, setPlan] = useState(null);
  const [projection, setProjection] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ignora le risposte di richieste superate (cambio mese / edit rapidi).
  const requestId = useRef(0);

  const refresh = useCallback(async (targetMonth = month) => {
    const id = ++requestId.current;
    setLoading(true);

    const results = await Promise.allSettled([
      api.dashboard(targetMonth),
      api.forecast(targetMonth),
      api.budgetAverages(),
      api.budgetAllocations(targetMonth),
      api.plan(targetMonth),
      api.projection(6, 0),
      api.meta(),
    ]);
    if (id !== requestId.current) return;

    const [dashboard, forecastResult, averages, allocations, planResult, projectionResult, metaResult] = results;
    if (dashboard.status === 'fulfilled') setData(dashboard.value);
    if (forecastResult.status === 'fulfilled') setForecast(forecastResult.value);
    if (averages.status === 'fulfilled') setBudgetAverages(averages.value);
    if (allocations.status === 'fulfilled') setBudgetAllocations(allocations.value);
    if (planResult.status === 'fulfilled') setPlan(planResult.value);
    if (projectionResult.status === 'fulfilled') setProjection(projectionResult.value);
    if (metaResult.status === 'fulfilled') setMeta(metaResult.value);

    const failed = results.find((result) => result.status === 'rejected');
    setError(failed ? failed.reason?.message || 'Errore di caricamento' : null);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    // refresh è asincrono: il setState avviene dopo la risposta di rete.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh(month);
  }, [month, refresh]);

  /** Esegue una mutazione + ricarica, senza far crashare la UI. */
  const mutate = useCallback(async (action) => {
    try {
      await action();
      return { ok: true };
    } catch (exc) {
      setError(exc.message);
      return { ok: false, error: exc.message };
    }
  }, []);

  const saveAllocations = useCallback(
    (allocations) => mutate(async () => {
      await api.saveAllocations(month, allocations);
      await refresh(month);
    }),
    [month, mutate, refresh],
  );

  const ingest = useCallback(
    async (fineco, revolut) => {
      setLoading(true);
      try {
        const result = await api.ingest(fineco, revolut);
        await refresh(month);
        return { ok: true, records_added: result?.records_added ?? 0 };
      } catch (exc) {
        setError(exc.message);
        return { ok: false, error: exc.message };
      } finally {
        setLoading(false);
      }
    },
    [month, refresh],
  );

  const addManual = useCallback(
    (payload) => mutate(async () => {
      await api.addManual(payload);
      await refresh(month);
    }),
    [month, mutate, refresh],
  );

  const updDesc = useCallback(
    (tx, value) => mutate(async () => {
      if (isManual(tx)) await api.updateManual(manualId(tx), manualPayload(tx, { description: value }));
      else await api.updateDescription(tx.hash_id, value);
      await refresh(month);
    }),
    [month, mutate, refresh],
  );

  const updCat = useCallback(
    (tx, value) => mutate(async () => {
      if (isManual(tx)) await api.updateManual(manualId(tx), manualPayload(tx, { micro_category: value }));
      else await api.updateCategory(tx.hash_id, value);
      await refresh(month);
    }),
    [month, mutate, refresh],
  );

  const updAmount = useCallback(
    (tx, value) => mutate(async () => {
      if (!isManual(tx)) return;
      await api.updateManual(manualId(tx), manualPayload(tx, { amount: value }));
      await refresh(month);
    }),
    [month, mutate, refresh],
  );

  const delManual = useCallback(
    (hashId) => mutate(async () => {
      if (!hashId?.startsWith('manual_')) return;
      await api.deleteManual(hashId.replace('manual_', ''));
      await refresh(month);
    }),
    [month, mutate, refresh],
  );

  const saveForecast = useCallback(
    (date, plannedIncome, plannedExpenses, notes) => mutate(async () => {
      await api.saveForecast({
        date,
        planned_income: plannedIncome,
        planned_expenses: plannedExpenses,
        notes,
      });
      await refresh(month);
    }),
    [month, mutate, refresh],
  );

  const deleteForecast = useCallback(
    (date) => mutate(async () => {
      await api.deleteForecast(date);
      await refresh(month);
    }),
    [month, mutate, refresh],
  );

  const loadProjection = useCallback(async (buffer = 0) => {
    try {
      const value = await api.projection(6, buffer);
      setProjection(value);
      return value;
    } catch {
      return null;
    }
  }, []);

  const generatePlan = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.generatePlan(month);
      await refresh(month);
      return { ok: true, ...result };
    } catch (exc) {
      setError(exc.message);
      return { ok: false, error: exc.message };
    } finally {
      setLoading(false);
    }
  }, [month, refresh]);

  return {
    data,
    forecast,
    budgetAverages,
    budgetAllocations,
    plan,
    projection,
    meta,
    loading,
    error,
    refresh,
    saveAllocations,
    ingest,
    addManual,
    updDesc,
    updCat,
    updAmount,
    delManual,
    saveForecast,
    deleteForecast,
    generatePlan,
    loadProjection,
  };
}
