'use server'

import { getNeo4jDriver } from '@/lib/neo4j';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

async function fetchAllSupabaseRecords(tableName: string) {
  let allRecords: Record<string, unknown>[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allRecords = [...allRecords, ...data];
    }

    if (!data || data.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allRecords;
}

export async function syncFromSupabase() {
  try {
    const emcees = await fetchAllSupabaseRecords('emcees');

    if (!emcees || emcees.length === 0) {
      return { success: true, count: 0 };
    }

    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const result = await session.executeWrite(async (tx) => {
        const query = `
          UNWIND $batch AS row
          MERGE (e:Emcee {id: row.id})
          SET e += row
          RETURN count(e) as syncedCount
        `;
        const res = await tx.run(query, { batch: emcees });
        return res.records[0].get('syncedCount').toNumber();
      });

      revalidatePath('/admin/neo4j');
      return { success: true, count: result };
    } finally {
      await session.close();
    }
  } catch (error: unknown) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error during sync';
    return { success: false, error: message };
  }
}

export async function updateEmcee(id: string, stage_name: string, hometown: string) {
  if (!id) return { success: false, error: 'ID is required' };
  
  const driver = getNeo4jDriver();
  const session = driver.session();
  
  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `
        MATCH (e:Emcee {id: $id})
        SET e.stage_name = $stage_name, e.hometown = $hometown
        RETURN e
        `,
        { id, stage_name, hometown }
      );
    });
    
    revalidatePath('/admin/neo4j');
    return { success: true };
  } catch (error: unknown) {
    console.error('Update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update Emcee';
    return { success: false, error: message };
  } finally {
    await session.close();
  }
}

export async function syncBattlesFromSupabase() {
  try {
    const battles = await fetchAllSupabaseRecords('battles');

    if (!battles || battles.length === 0) {
      return { success: true, count: 0 };
    }

    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const result = await session.executeWrite(async (tx) => {
        const query = `
          UNWIND $batch AS row
          MERGE (b:Battle {id: row.id})
          SET b += row
          RETURN count(b) as syncedCount
        `;
        const res = await tx.run(query, { batch: battles });
        return res.records[0].get('syncedCount').toNumber();
      });

      revalidatePath('/admin/neo4j/battles');
      return { success: true, count: result };
    } finally {
      await session.close();
    }
  } catch (error: unknown) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error during sync';
    return { success: false, error: message };
  }
}

export async function updateBattle(id: string, name: string, match_type: string, status: string) {
  if (!id) return { success: false, error: 'ID is required' };
  
  const driver = getNeo4jDriver();
  const session = driver.session();
  
  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `
        MATCH (b:Battle {id: $id})
        SET b.name = $name, b.match_type = $match_type, b.status = $status
        RETURN b
        `,
        { id, name, match_type, status }
      );
    });
    
    revalidatePath('/admin/neo4j/battles');
    return { success: true };
  } catch (error: unknown) {
    console.error('Update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update Battle';
    return { success: false, error: message };
  } finally {
    await session.close();
  }
}

export async function syncBattleRelationships() {
  try {
    const participants = await fetchAllSupabaseRecords('battle_participants');

    const battlesMap = new Map<string, Record<string, unknown>[]>();
    for (const p of participants) {
      if (!p.battle_id || !p.emcee_id) continue;
      if (!battlesMap.has(p.battle_id as string)) {
        battlesMap.set(p.battle_id as string, []);
      }
      battlesMap.get(p.battle_id as string)!.push(p);
    }

    const defeatedEdges: Record<string, unknown>[] = [];
    const battledEdges: Record<string, unknown>[] = [];

    for (const [battleId, parts] of battlesMap.entries()) {
      const teamA = parts.filter(p => (p.team_side as string)?.toLowerCase() === 'a');
      const teamB = parts.filter(p => (p.team_side as string)?.toLowerCase() === 'b');
      
      let side1 = teamA;
      let side2 = teamB;

      if ((side1.length === 0 || side2.length === 0) && parts.length === 2) {
         side1 = [parts[0]];
         side2 = [parts[1]];
      } else if (side1.length === 0 || side2.length === 0) {
         continue;
      }

      for (const a of side1) {
        for (const b of side2) {
          if (a.is_winner === true && b.is_winner !== true) {
             defeatedEdges.push({ winner_id: a.emcee_id, loser_id: b.emcee_id, battle_id: battleId, outcome: 'DEFEATED' });
          } else if (b.is_winner === true && a.is_winner !== true) {
             defeatedEdges.push({ winner_id: b.emcee_id, loser_id: a.emcee_id, battle_id: battleId, outcome: 'DEFEATED' });
          } else {
             battledEdges.push({ e1: a.emcee_id, e2: b.emcee_id, battle_id: battleId, outcome: 'BATTLED' });
          }
        }
      }
    }

    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const result = await session.executeWrite(async (tx) => {
        let count = 0;
        
        if (defeatedEdges.length > 0) {
          const res = await tx.run(`
            UNWIND $batch AS row
            MATCH (winner:Emcee {id: row.winner_id})
            MATCH (loser:Emcee {id: row.loser_id})
            MERGE (winner)-[r:DEFEATED {battle_id: row.battle_id}]->(loser)
            RETURN count(r) as c
          `, { batch: defeatedEdges });
          count += res.records[0].get('c').toNumber();
        }

        if (battledEdges.length > 0) {
          const res = await tx.run(`
            UNWIND $batch AS row
            MATCH (e1:Emcee {id: row.e1})
            MATCH (e2:Emcee {id: row.e2})
            MERGE (e1)-[r:BATTLED {battle_id: row.battle_id}]-(e2)
            RETURN count(r) as c
          `, { batch: battledEdges });
          count += res.records[0].get('c').toNumber();
        }

        return count;
      });

      revalidatePath('/admin/neo4j/participants');
      return { success: true, count: result };
    } finally {
      await session.close();
    }
  } catch (error: unknown) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error during sync';
    return { success: false, error: message };
  }
}

export async function updateRelationshipOutcome(e1_id: string, e2_id: string, battle_id: string, newOutcome: 'e1_won' | 'e2_won' | 'draw') {
  const driver = getNeo4jDriver();
  const session = driver.session();
  
  try {
    await session.executeWrite(async (tx) => {
      await tx.run(`
        MATCH (e1:Emcee {id: $e1_id})-[r {battle_id: $battle_id}]-(e2:Emcee {id: $e2_id})
        WHERE type(r) IN ['BATTLED', 'DEFEATED']
        DELETE r
      `, { e1_id, e2_id, battle_id });

      if (newOutcome === 'e1_won') {
        await tx.run(`
          MATCH (winner:Emcee {id: $e1_id})
          MATCH (loser:Emcee {id: $e2_id})
          MERGE (winner)-[:DEFEATED {battle_id: $battle_id}]->(loser)
        `, { e1_id, e2_id, battle_id });
      } else if (newOutcome === 'e2_won') {
        await tx.run(`
          MATCH (winner:Emcee {id: $e2_id})
          MATCH (loser:Emcee {id: $e1_id})
          MERGE (winner)-[:DEFEATED {battle_id: $battle_id}]->(loser)
        `, { e1_id, e2_id, battle_id });
      } else {
        await tx.run(`
          MATCH (e1:Emcee {id: $e1_id})
          MATCH (e2:Emcee {id: $e2_id})
          MERGE (e1)-[:BATTLED {battle_id: $battle_id}]-(e2)
        `, { e1_id, e2_id, battle_id });
      }
    });
    
    revalidatePath('/admin/neo4j/participants');
    return { success: true };
  } catch (error: unknown) {
    console.error('Update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update relationship';
    return { success: false, error: message };
  } finally {
    await session.close();
  }
}
