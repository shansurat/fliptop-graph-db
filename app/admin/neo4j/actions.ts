'use server'

import { getNeo4jDriver } from '@/lib/neo4j';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function syncFromSupabase() {
  try {
    const { data: emcees, error } = await supabase
      .from('emcees')
      .select('*');

    if (error) {
      console.error('Supabase fetch error:', error);
      return { success: false, error: error.message };
    }

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
