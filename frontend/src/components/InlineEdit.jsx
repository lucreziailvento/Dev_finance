import { useEffect, useRef, useState } from 'react';

export default function InlineEdit({ value, onSave, className = '', inputClassName = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else setDraft(value);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') cancel();
        }}
        className={`bg-slate-800 border border-cyan-500 rounded-lg px-2 py-0.5 text-sm text-slate-100 focus:outline-none ${className} ${inputClassName}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`text-left hover:bg-white/5 rounded-lg px-2 py-0.5 transition-colors ${className}`}
    >
      {value}
    </button>
  );
}
