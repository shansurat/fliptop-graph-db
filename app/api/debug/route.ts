import { NextResponse } from 'next/server';
import { getNeo4jDriver } from '@/lib/neo4j';

export async function GET() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  
  const bRes = await session.run(`
    MATCH (source:Emcee)-[r]->(target:Emcee)
    WHERE type(r) IN ['DEFEATED', 'BATTLED']
    MATCH (b:Battle {id: r.battle_id})
    RETURN b.match_type AS type, count(r) AS relCount
  `);
  
  const counts = bRes.records.map(r => ({ type: r.get('type'), count: r.get('relCount').toNumber() }));
  await session.close();
  return NextResponse.json(counts);
}
