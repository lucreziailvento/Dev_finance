import { COLORS } from '../constants';
import CategorySelect from './CategorySelect';
import InlineAmount from './InlineAmount';
import InlineEdit from './InlineEdit';

function dotColor(tx) {
  if (tx.macro_category === 'Trasferimento Interno') return COLORS.transfers;
  if (tx.macro_category === 'Investimenti') return COLORS.invested;
  return tx.amount < 0 ? COLORS.expenses : COLORS.income;
}

export default function TransactionRow({
  tx,
  onUpdateDescription,
  onUpdateCategory,
  onUpdateAmount,
  onDelete = null,
  onMakeRule = null,
  showDate = false,
}) {
  const isExpense = tx.amount < 0;
  const isManual = tx.hash_id?.startsWith('manual_');

  return (
    <div className="flex items-center gap-3 py-2.5 px-1 rounded-xl hover:bg-white/5 transition-colors">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor(tx) }}
      />
      <div className="flex-1 min-w-0">
        <InlineEdit
          value={tx.description}
          onSave={(value) => onUpdateDescription(tx, value)}
          className="text-sm text-slate-200 truncate block w-full"
        />
        <CategorySelect
          value={tx.micro_category}
          onChange={(value) => onUpdateCategory(tx, value)}
          className="text-xs text-slate-500"
        />
      </div>
      <div className="text-right">
        <InlineAmount
          amount={tx.amount}
          editable={Boolean(onUpdateAmount)}
          onSave={(value) => onUpdateAmount(tx, value)}
          className={`text-sm font-bold ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}
        />
        {showDate && <p className="text-[11px] text-slate-600">{tx.date}</p>}
      </div>
      {onMakeRule && !isManual && (
        <button
          type="button"
          onClick={() => onMakeRule(tx)}
          title="Crea regola da questa transazione"
          className="w-7 h-7 flex-shrink-0 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
        >
          🔁
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(tx)}
          title="Elimina transazione"
          aria-label={`Elimina ${tx.description}`}
          className="w-7 h-7 flex-shrink-0 rounded-lg bg-white/5 hover:bg-rose-500/20 text-xs text-slate-400 hover:text-rose-300 transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}
