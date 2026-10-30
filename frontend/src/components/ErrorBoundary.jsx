import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Errore non gestito nella UI:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#0a0f1e] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-[#111827] border border-rose-500/30 rounded-2xl p-6 text-center">
          <p className="text-2xl mb-2">⚠️</p>
          <h1 className="text-base font-bold mb-2">Qualcosa è andato storto</h1>
          <p className="text-sm text-slate-400 mb-4 break-words">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-bold hover:opacity-90 transition-all"
          >
            Ricarica
          </button>
        </div>
      </div>
    );
  }
}
