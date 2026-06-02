import { getNeo4jDriver } from '@/lib/neo4j';
import Neo4jClientPage from './Neo4jClientPage';
import { syncFromSupabase, updateEmcee } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Neo4jAdminPage() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  let emcees = [];

  try {
    const result = await session.run('MATCH (e:Emcee) RETURN e ORDER BY e.stage_name ASC');
    emcees = result.records.map((record) => record.get('e').properties);
  } catch (error) {
    console.error('Error fetching from Neo4j:', error);
  } finally {
    await session.close();
  }

  return (
    <div className="container mx-auto py-12 px-8 max-w-4xl min-h-screen text-[#cfcfcf]">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-[#FFFFFF] tracking-tight mb-2">Neo4j Management</h1>
        <p className="text-[#A3A3A3] text-sm">
          Directly manage graph database nodes and synchronize records from Supabase.
        </p>
      </div>

      <Neo4jClientPage 
        initialEmcees={emcees} 
        syncAction={syncFromSupabase} 
        updateAction={updateEmcee} 
      />
    </div>
  );
}
