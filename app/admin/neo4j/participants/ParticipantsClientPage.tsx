'use client'

import { useState } from 'react';

type Relationship = {
  e1_id: string;
  e1_name: string;
  e2_id: string;
  e2_name: string;
  battle_id: string;
  outcome: 'DEFEATED' | 'BATTLED';
};

interface Props {
  initialRelationships: Relationship[];
  syncAction: () => Promise<{ success: boolean; count?: number; error?: string }>;
  updateAction: (e1_id: string, e2_id: string, battle_id: string, newOutcome: 'e1_won' | 'e2_won' | 'draw') => Promise<{ success: boolean; error?: string }>;
}

export default function ParticipantsClientPage({ initialRelationships, syncAction, updateAction }: Props) {
  const [relationships, setRelationships] = useState<Relationship[]>(initialRelationships);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editFormOutcome, setEditFormOutcome] = useState<'e1_won' | 'e2_won' | 'draw'>('draw');
  
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [prevInitial, setPrevInitial] = useState(initialRelationships);

  if (initialRelationships !== prevInitial) {
    setPrevInitial(initialRelationships);
    setRelationships(initialRelationships);
  }

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const result = await syncAction();
      if (result.success) {
        setMessage({ text: `Successfully synced ${result.count} relationships from Supabase.`, type: 'success' });
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

  const getEdgeKey = (rel: Relationship) => `${rel.battle_id}-${rel.e1_id}-${rel.e2_id}`;

  const handleEditClick = (rel: Relationship) => {
    setEditingKey(getEdgeKey(rel));
    setEditFormOutcome(rel.outcome === 'DEFEATED' ? 'e1_won' : 'draw');
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
  };

  const handleSaveEdit = async (rel: Relationship) => {
    setMessage(null);
    try {
      const result = await updateAction(rel.e1_id, rel.e2_id, rel.battle_id, editFormOutcome);
      if (result.success) {
        setMessage({ text: 'Successfully updated relationship in Neo4j.', type: 'success' });
        
        setRelationships(relationships.map(r => {
          if (getEdgeKey(r) === getEdgeKey(rel)) {
            if (editFormOutcome === 'e1_won') return { ...r, outcome: 'DEFEATED' };
            if (editFormOutcome === 'e2_won') return { ...r, outcome: 'DEFEATED', e1_id: r.e2_id, e1_name: r.e2_name, e2_id: r.e1_id, e2_name: r.e1_name };
            return { ...r, outcome: 'BATTLED' };
          }
          return r;
        }));
        setEditingKey(null);
      } else {
        setMessage({ text: `Update failed: ${result.error}`, type: 'error' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'An unexpected error occurred during update.', type: 'error' });
    }
  };

  const totalPages = Math.ceil(relationships.length / pageSize);
  const paginatedRelationships = relationships.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8 border-b border-[#2f2f2f] pb-4">
        <h2 className="text-xl font-semibold text-[#cfcfcf]">Emcee Relationships</h2>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="bg-transparent hover:bg-[#2f2f2f] border border-[#2f2f2f] text-[#cfcfcf] text-sm py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSyncing ? (
             <>
               <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-[#cfcfcf] inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Syncing...
             </>
          ) : 'Sync from Supabase'}
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
              <th className="py-2 px-3 font-normal">Battle ID</th>
              <th className="py-2 px-3 font-normal text-right">Emcee 1</th>
              <th className="py-2 px-3 font-normal text-center">Outcome</th>
              <th className="py-2 px-3 font-normal">Emcee 2</th>
              <th className="py-2 px-3 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2f2f2f]">
            {relationships.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#707070] text-sm">
                  No relationships found in Neo4j. Try syncing from Supabase.
                </td>
              </tr>
            ) : (
              paginatedRelationships.map((rel) => {
                const isEditing = editingKey === getEdgeKey(rel);
                
                return (
                  <tr key={getEdgeKey(rel)} className="hover:bg-[#202020] transition-colors group">
                    <td className="py-2.5 px-3 text-[#707070] text-sm font-mono">{rel.battle_id.substring(0, 8)}...</td>
                    <td className="py-2.5 px-3 text-sm text-[#cfcfcf] font-medium text-right">{rel.e1_name || 'Unknown'}</td>
                    <td className="py-2.5 px-3 text-sm text-center">
                      {isEditing ? (
                        <select
                          value={editFormOutcome}
                          onChange={(e) => setEditFormOutcome(e.target.value as 'e1_won' | 'e2_won' | 'draw')}
                          className="bg-[#191919] border border-[#2f2f2f] text-[#cfcfcf] rounded px-2 py-1 text-sm focus:border-[#5E87C9] focus:outline-none"
                        >
                          <option value="e1_won">Defeated (Left Won)</option>
                          <option value="e2_won">Defeated By (Right Won)</option>
                          <option value="draw">Battled (Draw)</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${rel.outcome === 'DEFEATED' ? 'bg-[#2a3f2a] text-[#71cf71]' : 'bg-[#2f2f2f] text-[#A3A3A3]'}`}>
                          {rel.outcome}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-[#cfcfcf] font-medium">{rel.e2_name || 'Unknown'}</td>
                    <td className="py-2.5 px-3 text-sm">
                      {isEditing ? (
                        <div className="flex gap-3">
                          <button onClick={() => handleSaveEdit(rel)} className="text-[#cfcfcf] hover:text-white transition-colors">Save</button>
                          <button onClick={handleCancelEdit} className="text-[#707070] hover:text-[#A3A3A3] transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => handleEditClick(rel)} className="text-[#707070] hover:text-[#cfcfcf] opacity-0 group-hover:opacity-100 transition-all">Edit Outcome</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-[#707070] text-sm">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, relationships.length)} of {relationships.length} records
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
