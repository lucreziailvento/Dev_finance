import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export function useFinance(month) {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState({ forecasts: [], actuals: {} });
  const [budgetAverages, setBudgetAverages] = useState(null);
  const [budgetAllocations, setBudgetAllocations] = useState({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (m) => {
    setLoading(true);
    try {
      const [d, f] = await Promise.all([api.dashboard(m), api.forecast(m)]);
      if (!d.error) setData(d);
      if (!f.error) setForecast(f);
    } catch { /* backend non raggiungibile */ }
    try {
      const j = await api.budgetAverages();
      if (!j.error) setBudgetAverages(j);
    } catch { /* backend non raggiungibile */ }
    try {
      const j = await api.budgetAllocations(m);
      if (!j.error) setBudgetAllocations(j);
    } catch { /* backend non raggiungibile */ }
    setLoading(false);
  }, []);

  const fetchData = useCallback(async (m) => {
    try { const j = await api.dashboard(m); if (!j.error) setData(j); } catch { /* backend non raggiungibile */ }
  }, []);

  const fetchForecast = useCallback(async (m) => {
    try { const j = await api.forecast(m); if (!j.error) setForecast(j); } catch { /* backend non raggiungibile */ }
  }, []);

  const fetchBudgetAverages = useCallback(async () => {
    try { const j = await api.budgetAverages(); if (!j.error) setBudgetAverages(j); } catch { /* backend non raggiungibile */ }
  }, []);

  const fetchBudgetAllocations = useCallback(async (m) => {
    try { const j = await api.budgetAllocations(m); if (!j.error) setBudgetAllocations(j); } catch { /* backend non raggiungibile */ }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh(month);
  }, [month, refresh]);

  const saveAllocations = useCallback(async (allocations) => {
    await api.saveAllocations(month, allocations);
    fetchBudgetAverages();
    fetchBudgetAllocations(month);
  }, [month, fetchBudgetAverages, fetchBudgetAllocations]);

  const ingest = useCallback(async (fineco, revolut) => {
    setLoading(true);
    try {
      const j = await api.ingest(fineco, revolut);
      if (j.records_added != null) {
        refresh(month);
        return { ok: true, records_added: j.records_added };
      }
      return { ok: false, error: j.detail || 'Errore ingest' };
    } catch {
      return { ok: false, error: 'Errore ingest' };
    } finally { setLoading(false); }
  }, [month, refresh]);

  const addManual = useCallback(async (payload) => {
    await api.addManual(payload);
    fetchData(month);
    fetchForecast(month);
  }, [month, fetchData, fetchForecast]);

  const updDesc = useCallback(async (tx, val) => {
    if (tx.hash_id.startsWith('manual_')) {
      await api.updateManual(tx.hash_id.replace('manual_', ''), {
        date: tx.date, description: val, amount: Math.abs(tx.amount),
        micro_category: tx.micro_category, type: tx.amount > 0 ? 'entrata' : 'spesa',
      });
    } else {
      await api.updateDescription(tx.hash_id, val);
    }
    fetchData(month);
  }, [month, fetchData]);

  const updCat = useCallback(async (tx, val) => {
    if (tx.hash_id.startsWith('manual_')) {
      await api.updateManual(tx.hash_id.replace('manual_', ''), {
        date: tx.date, description: tx.description, amount: Math.abs(tx.amount),
        micro_category: val, type: tx.amount > 0 ? 'entrata' : 'spesa',
      });
    } else {
      await api.updateCategory(tx.hash_id, val);
    }
    fetchData(month);
  }, [month, fetchData]);

  const updAmount = useCallback(async (tx, val) => {
    if (tx.hash_id.startsWith('manual_')) {
      await api.updateManual(tx.hash_id.replace('manual_', ''), {
        date: tx.date, description: tx.description, amount: val,
        micro_category: tx.micro_category, type: tx.amount > 0 ? 'entrata' : 'spesa',
      });
    }
    fetchData(month);
  }, [month, fetchData]);

  const delManual = useCallback(async (hashId) => {
    if (!hashId.startsWith('manual_')) return;
    await api.deleteManual(hashId.replace('manual_', ''));
    fetchData(month);
    fetchForecast(month);
  }, [month, fetchData, fetchForecast]);

  const saveForecast = useCallback(async (date, pi, pe, notes) => {
    await api.saveForecast({ date, planned_income: pi, planned_expenses: pe, notes });
    fetchForecast(month);
  }, [month, fetchForecast]);

  const deleteForecast = useCallback(async (date) => {
    await api.deleteForecast(date);
    fetchForecast(month);
  }, [month, fetchForecast]);

  return {
    data, forecast, budgetAverages, budgetAllocations, loading,
    refresh, fetchData, fetchForecast, fetchBudgetAverages, fetchBudgetAllocations,
    saveAllocations, ingest, addManual, updDesc, updCat, updAmount, delManual,
    saveForecast, deleteForecast,
  };
}
