import { useState } from 'react';
import { useGame } from '../../store/game';
import { deleteSave } from '../../store/db';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { game, updateSettings, startNew } = useGame();
  const s = game!.settings;
  const [draft, setDraft] = useState(s);
  const save = () => { updateSettings(draft); onClose(); };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-lg w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Settings & integrations</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        <p className="text-xs text-slate-500">The game works fully offline. These optional services only enrich the audience pre-test and creative backgrounds. Keys are stored in this browser’s IndexedDB with your save.</p>
        <div>
          <label className="label">Audience pre-test engine</label>
          <select className="input" value={draft.consumerAdapter} onChange={(e) => setDraft({ ...draft, consumerAdapter: e.target.value as 'local' | 'remote' })}>
            <option value="local">Local panel (default, offline)</option>
            <option value="remote">Remote multi-agent service (e.g. MiroFish shim)</option>
          </select>
          {draft.consumerAdapter === 'remote' && (
            <input className="input mt-2" placeholder="https://your-sim-service/pretest" value={draft.remoteSimUrl} onChange={(e) => setDraft({ ...draft, remoteSimUrl: e.target.value })} />
          )}
          <p className="text-xs text-slate-500 mt-1">Expects POST → <code>{'{ segments: [{ id, resonance, note }] }'}</code>. Invalid responses fall back to the local panel.</p>
        </div>
        <div>
          <label className="label">AI background generator (optional)</label>
          <input className="input" placeholder="https://your-image-endpoint" value={draft.imageApiUrl} onChange={(e) => setDraft({ ...draft, imageApiUrl: e.target.value })} />
          <input className="input mt-2" type="password" placeholder="API key (optional)" value={draft.imageApiKey} onChange={(e) => setDraft({ ...draft, imageApiKey: e.target.value })} />
          <p className="text-xs text-slate-500 mt-1">Expects POST <code>{'{ prompt }'}</code> → <code>{'{ image: "data:image/png;base64,…" }'}</code>.</p>
        </div>
        <div className="flex justify-between pt-2 border-t">
          <button className="btn-ghost text-red-600" onClick={async () => { if (confirm('Start over? Your current save will be replaced.')) { await deleteSave(); startNew(); onClose(); } }}>Restart game</button>
          <button className="btn-primary" onClick={save}>Save settings</button>
        </div>
      </div>
    </div>
  );
}
