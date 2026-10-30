import { useEffect, useRef, useState } from 'react';

const formatAmount = (value) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function InlineAmount({ amount, editable = false, onSave, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.abs(amount)));
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const value = parseFloat(draft);
    if (!Number.isNaN(value) && value > 0 && value !== Math.abs(amount)) onSave(value);
    else setDraft(String(Math.abs(amount)));
  };

  const cancel = () => {
    setDraft(String(Math.abs(amount)));
    setEditing(false);
  };

  if (!editable) {
    return <span className={`font-mono ${className}`}>{formatAmount(amount)}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') cancel();
        }}
        className={`w-24 bg-slate-800 border border-cyan-500 rounded-lg px-2 py-0.5 text-sm text-right font-mono text-slate-100 focus:outline-none ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(String(Math.abs(amount)));
        setEditing(true);
      }}
      className={`font-mono hover:bg-white/5 rounded-lg px-1 transition-colors cursor-pointer ${className}`}
    >
      {formatAmount(amount)}
    </button>
  );
}
