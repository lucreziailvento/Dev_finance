import { useState } from 'react';
import { CATEGORIES } from '../constants';

export default function CategorySelect({ value, onChange, className = '', categories = CATEGORIES }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`text-xs hover:bg-white/5 rounded-lg px-2 py-0.5 transition-colors ${className}`}
      >
        {value}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-20 bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-h-48 overflow-y-auto min-w-[200px] py-1">
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                onClick={() => {
                  onChange(category);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                  category === value ? 'text-cyan-400 font-bold' : 'text-slate-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
