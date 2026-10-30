import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { monthLabel, monthFull } from '../../constants';
import { currentMonth, eur, eur2, pct, shortDate } from '../../lib/format';

const CHART_TOOLTIP = {
  contentStyle: {
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    fontSize: 12,
  },
};

function AlertBanner({ alert }) {
  const palette = alert.level === 'warning'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${palette}`}>
      <p className="text-xs font-bold">{alert.title}</p>
      <p className="text-[11px] opacity-80 mt-0.5">{alert.detail}</p>
    </div>
  );
}

function DayRow({ day, isToday, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [income, setIncome] = useState(String(day.planned_income || ''));
  const [expenses, setExpenses] = useState(String(day.planned_expenses || ''));
  const [notes, setNotes] = useState(day.notes || '');

  const hasActual = day.actual_income > 0 || day.actual_expenses > 0;
  const hasPlan = day.planned_income > 0 || day.planned_expenses > 0;

  const save = () => {
    onSave(
      day.date,
      parseFloat(income) || 0,
      parseFloat(expenses) || 0,
      notes,
    );
    setEditing(false);
  };

  const reset = () => {
    setIncome(String(day.planned_income || ''));
    setExpenses(String(day.planned_expenses || ''));
    setNotes(day.notes || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-cyan-300">{shortDate(day.date)}</p>
          <button onClick={reset} className="text-[11px] text-slate-400 hover:text-slate-200">Annulla</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-slate-400">
            Entrate
            <input
              type="number"
              step="0.01"
              value={income}
              onChange={(event) => setIncome(event.target.value)}
              className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </label>
          <label className="text-[10px] text-slate-400">
            Spese
            <input
              type="number"
              step="0.01"
              value={expenses}
              onChange={(event) => setExpenses(event.target.value)}
              className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </label>
        </div>
        <input
          type="text"
          value={notes}
          placeholder="Note (es. spesa, palestra...)"
          onChange={(event) => setNotes(event.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
        />
        <div className="flex gap-2">
          <button onClick={save} className="flex-1 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400">
            Salva
          </button>
          <button
            onClick={() => { onDelete(day.date); setEditing(false); }}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-rose-300 text-xs font-bold hover:bg-white/10"
          >
            Elimina
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`w-full text-left rounded-2xl px-3 py-2 transition-colors hover:bg-white/5 ${
        isToday ? 'border border-cyan-500/40 bg-cyan-500/5' : 'border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-300 w-16">
          {shortDate(day.date)}
        </span>
        <div className="flex-1 min-w-0">
          {day.recurring.length > 0 ? (
            <p className="text-[11px] text-slate-400 truncate">
              🔁 {day.recurring.map((item) => item.name).join(', ')}
            </p>
          ) : day.notes ? (
            <p className="text-[11px] text-slate-500 truncate">{day.notes}</p>
          ) : null}
        </div>
        <div className="text-right flex-shrink-0">
          {hasActual && (
            <p className="text-[10px] text-slate-500">
              reale {day.actual_income > 0 ? `+${eur2(day.actual_income)}` : ''}
              {day.actual_expenses > 0 ? ` −${eur2(day.actual_expenses)}` : ''}
            </p>
          )}
          <p className="text-xs font-bold">
            {hasPlan ? (
              <>
                {day.planned_income > 0 && <span className="text-emerald-400">+{eur2(day.planned_income)} </span>}
                {day.planned_expenses > 0 && <span className="text-rose-400">−{eur2(day.planned_expenses)}</span>}
              </>
            ) : (
              <span className="text-slate-600">—</span>
            )}
          </p>
        </div>
      </div>
    </button>
  );
}

function ProjectionCard({ projection, onLoadProjection }) {
  const [buffer, setBuffer] = useState(0);

  if (!projection) return null;
  const points = projection.points || [];
  const chartRows = points.map((point) => ({ ...point, label: monthLabel(point.month) }));

  const changeBuffer = (value) => {
    setBuffer(value);
    onLoadProjection(value);
  };

  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xs font-bold text-violet-300 uppercase tracking-wider">Proiezione 6 mesi</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Mediane ultimi {projection.history_months} mesi · risparmio iniziale {eur(projection.start_savings)}
          </p>
        </div>
        <span className="text-xs font-bold text-violet-300">
          {eur(points[points.length - 1]?.cumulative)}
        </span>
      </div>

      <div className="h-40 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartRows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} width={46} />
            <Tooltip
              {...CHART_TOOLTIP}
              formatter={(value, name) => [eur(value), name === 'cumulative' ? 'Cumulato' : 'Risparmio mese']}
            />
            <Bar dataKey="net" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="cumulative" stroke="#22d3ee" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>Cuscinetto di sicurezza sulle spese</span>
          <span className="font-bold text-slate-200">{pct(buffer * 100)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="0.4"
          step="0.05"
          value={buffer}
          onChange={(event) => changeBuffer(parseFloat(event.target.value))}
          className="w-full accent-violet-500"
        />
      </div>

      <p className="text-[11px] text-slate-500 mt-2">
        Spese stimate {eur(projection.med_expenses)}/mese, entrate {eur(projection.med_income)}/mese.
      </p>
    </section>
  );
}

function RecurringCard({ items }) {
  const visible = (items || []).slice(0, 8);

  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Movimenti ricorrenti</h3>
        <span className="text-[10px] text-slate-500">{items.length} rilevati</span>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          Nessuna ricorrenza trovata: servono almeno 3 mesi di movimenti simili.
        </p>
      ) : (
        <div className="divide-y divide-white/5">
          {visible.map((item) => (
            <div key={item.key} className="flex items-center gap-3 py-2">
              <span className="text-base">{item.kind === 'income' ? '💸' : '🔁'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 truncate">{item.name}</p>
                <p className="text-[10px] text-slate-500">
                  {item.category} · ogni {item.interval_days} giorni · prossimo {shortDate(item.next_expected)}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-bold ${item.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {item.kind === 'income' ? '+' : '−'}{eur2(item.monthly_impact)}
                </p>
                <p className="text-[10px] text-slate-600">affidabilità {item.confidence}%</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PlanView({
  plan,
  projection,
  month,
  onGenerate,
  onSaveForecast,
  onDeleteForecast,
  onLoadProjection,
  generating,
}) {
  const [showAllDays, setShowAllDays] = useState(false);

  if (!plan) {
    return <div className="text-center py-20 text-slate-500 text-sm">Caricamento piano...</div>;
  }

  const isFuture = month > currentMonth();
  const isPast = month < currentMonth();
  const canGenerate = !isPast;

  const days = plan.days.filter((day) => {
    if (showAllDays) return true;
    if (day.actual_income > 0 || day.actual_expenses > 0) return true;
    if (day.planned_income > 0 || day.planned_expenses > 0) return true;
    if (day.recurring.length > 0) return true;
    return day.date === plan.today && !isPast;
  });

  const hasActivity = days.length > 0;

  return (
    <div className="space-y-4">
      <section className="bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-violet-500/10 border border-cyan-500/20 rounded-3xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Piano di {monthFull(month)}</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              {isPast
                ? 'Mese chiuso'
                : isFuture
                  ? 'Mese futuro, basato sullo storico'
                  : plan.days_left === 0
                    ? 'Ultimo giorno del mese'
                    : plan.days_left === 1
                      ? 'Resta 1 giorno'
                      : `Restano ${plan.days_left} giorni`}
            </p>
          </div>
          {canGenerate && (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="px-3 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black hover:bg-cyan-400 disabled:opacity-50 transition-all active:scale-95"
            >
              {generating ? 'Genero...' : plan.has_plan ? 'Rigenera' : 'Genera piano'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-slate-400 mb-1">Entrate previste</p>
            <p className="text-base font-black text-emerald-300">{eur(plan.projected_income)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-1">Spese previste</p>
            <p className="text-base font-black text-rose-300">{eur(plan.projected_expenses)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-1">Risparmio</p>
            <p className={`text-base font-black ${plan.projected_savings >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
              {eur(plan.projected_savings)}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Spese reali del mese</span>
            <span className="font-bold text-slate-200">{eur(plan.totals.actual_expenses)}</span>
          </div>
          {plan.totals.planned_expenses > 0 && (
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Pianificato residuo</span>
              <span className="font-bold text-slate-200">{eur(plan.totals.planned_remaining)}</span>
            </div>
          )}
        </div>
      </section>

      {plan.data_stale_days !== null && plan.data_stale_days > 45 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-bold text-amber-200">Dati non aggiornati</p>
          <p className="text-[11px] text-amber-200/80 mt-0.5">
            Ultima transazione {plan.last_data_date} ({plan.data_stale_days} giorni fa).
            Importa gli estratti conto per un piano preciso.
          </p>
        </div>
      )}

      {plan.alerts.filter((alert) => alert.title !== 'Dati non aggiornati').map((alert) => (
        <AlertBanner key={alert.title} alert={alert} />
      ))}

      {plan.budget.allocations.length > 0 && (
        <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Budget del mese</h3>
            <span className="text-[10px] text-slate-500">
              {eur(plan.budget.spent)} / {eur(plan.budget.total_planned)}
            </span>
          </div>
          <div className="space-y-2.5">
            {plan.budget.allocations.slice(0, 6).map((row) => (
              <div key={row.name}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">{row.name}</span>
                  <span className={row.spent > row.planned ? 'text-rose-300' : 'text-slate-300'}>
                    {eur(row.spent)} / {eur(row.planned)}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.spent > row.planned ? 'bg-rose-500' : 'bg-cyan-500'}`}
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Giorno per giorno</h3>
          <button
            onClick={() => setShowAllDays((value) => !value)}
            className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
          >
            {showAllDays ? 'Solo giorni con movimenti' : `Tutti i ${plan.days_in_month} giorni`}
          </button>
        </div>

        {!hasActivity ? (
          <p className="text-xs text-slate-500 py-3">
            {isPast ? 'Nessun movimento in questo mese.' : 'Genera il piano per vedere quanto puoi spendere ogni giorno.'}
          </p>
        ) : (
          <div className="space-y-1">
            {days.map((day) => (
              <DayRow
                key={day.date}
                day={day}
                isToday={day.date === plan.today}
                onSave={onSaveForecast}
                onDelete={onDeleteForecast}
              />
            ))}
          </div>
        )}
      </section>

      <RecurringCard items={plan.recurring} />
      <ProjectionCard projection={projection} onLoadProjection={onLoadProjection} />
    </div>
  );
}
