'use client'

import { useState } from 'react';

type Battle = {
  id: string;
  name?: string;
  match_type?: string;
  status?: string;
  [key: string]: unknown;
};

interface Props {
  initialBattles: Battle[];
  syncAction: () => Promise<{ success: boolean; count?: number; error?: string }>;
  updateAction: (id: string, name: string, match_type: string, status: string) => Promise<{ success: boolean; error?: string }>;
}

export default function BattlesClientPage({ initialBattles, syncAction, updateAction }: Props) {
  const [battles, setBattles] = useState<Battle[]>(initialBattles);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', match_type: '', status: '' });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [prevInitial, setPrevInitial] = useState(initialBattles);

  if (initialBattles !== prevInitial) {
    setPrevInitial(initialBattles);
    setBattles(initialBattles);
  }

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const result = await syncAction();
      if (result.success) {
        setMessage({ text: `Successfully synced ${result.count} records from Supabase.`, type: 'success' });
        setCurrentPage(1);
      } else {
        setMessage({ text: `Sync failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during sync.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditClick = (battle: Battle) => {
    setEditingId(battle.id);
    setEditForm({
      name: battle.name || '',
      match_type: battle.match_type || '',
      status: battle.status || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setMessage(null);
    
    try {
      const result = await updateAction(editingId, editForm.name, editForm.match_type, editForm.status);
      if (result.success) {
        setMessage({ text: 'Successfully updated record in Neo4j.', type: 'success' });
        setBattles(battles.map(b => b.id === editingId ? { ...b, ...editForm } : b));
        setEditingId(null);
      } else {
        setMessage({ text: `Update failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during update.', type: 'error' });
    }
  };

  const totalPages = Math.ceil(battles.length / pageSize);
  const paginatedBattles = battles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8 border-b border-[#2f2f2f] pb-4">
        <h2 className="text-xl font-semibold text-[#cfcfcf]">Battles</h2>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="bg-transparent hover:bg-[#2f2f2f] border border-[#2f2f2f] text-[#cfcfcf] text-sm py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSyncing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-[#cfcfcf]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Syncing...
            </>
          ) : (
            'Sync from Supabase'
          )}
        </button>
      </div>

      {message && (
        <div className={`p-3 mb-6 rounded text-sm ${message.type === 'success' ? 'bg-[#2F2F2F] text-[#cfcfcf] border border-[#373737]' : 'bg-[#3b2a2a] text-[#eb5757] border border-[#4d3636]'}`}>
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[#707070] text-sm border-b border-[#2f2f2f]">
              <th className="py-2 px-3 font-normal">ID</th>
              <th className="py-2 px-3 font-normal">Name</th>
              <th className="py-2 px-3 font-normal">Match Type</th>
              <th className="py-2 px-3 font-normal">Status</th>
              <th className="py-2 px-3 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2f2f2f]">
            {battles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#707070] text-sm">
                  No records found in Neo4j. Try syncing from Supabase.
                </td>
              </tr>
            ) : (
              paginatedBattles.map((battle) => (
                <tr key={battle.id} className="hover:bg-[#202020] transition-colors group">
                  <td className="py-2.5 px-3 text-[#707070] text-sm font-mono">{battle.id}</td>
                  <td className="py-2.5 px-3 text-sm text-[#cfcfcf]">
                    {editingId === battle.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full bg-[#191919] border border-[#2f2f2f] text-[#cfcfcf] rounded px-2 py-1 text-sm focus:border-[#5E87C9] focus:outline-none transition-colors"
                      />
                    ) : (
                      <span>{battle.name || '-'}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-[#cfcfcf]">
                    {editingId === battle.id ? (
                      <input
                        type="text"
                        value={editForm.match_type}
                        onChange={(e) => setEditForm({ ...editForm, match_type: e.target.value })}
                        className="w-full bg-[#191919] border border-[#2f2f2f] text-[#cfcfcf] rounded px-2 py-1 text-sm focus:border-[#5E87C9] focus:outline-none transition-colors"
                      />
                    ) : (
                      <span className="text-[#A3A3A3]">{battle.match_type || '-'}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-[#cfcfcf]">
                    {editingId === battle.id ? (
                      <input
                        type="text"
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full bg-[#191919] border border-[#2f2f2f] text-[#cfcfcf] rounded px-2 py-1 text-sm focus:border-[#5E87C9] focus:outline-none transition-colors"
                      />
                    ) : (
                      <span className="text-[#A3A3A3]">{battle.status || '-'}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-sm">
                    {editingId === battle.id ? (
                      <div className="flex gap-3">
                        <button onClick={handleSaveEdit} className="text-[#cfcfcf] hover:text-white transition-colors">Save</button>
                        <button onClick={handleCancelEdit} className="text-[#707070] hover:text-[#A3A3A3] transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => handleEditClick(battle)} className="text-[#707070] hover:text-[#cfcfcf] opacity-0 group-hover:opacity-100 transition-all">Edit</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-[#707070] text-sm">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, battles.length)} of {battles.length} records
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded hover:bg-[#2f2f2f] disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded hover:bg-[#2f2f2f] disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
