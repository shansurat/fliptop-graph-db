import { fetchGraphDataForVisualization } from '../actions';
import GraphClient from '../ForceGraphWrapper';

export const dynamicConfig = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';

export default async function VisualizationAdminPage() {
  const result = await fetchGraphDataForVisualization();
  
  const graphData = result.success && result.data ? result.data : { nodes: [], links: [] };

  return (
    <div className="w-full h-screen bg-black text-white relative overflow-hidden">
      {/* Top-Center Mode Navigation */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-1 p-1 bg-[#1a1a1a] rounded-full border border-[#333] shadow-lg">
        <Link 
          href="/" 
          className="px-6 py-2 rounded-full text-sm font-medium transition-colors text-[#A3A3A3] hover:text-white hover:bg-[#222]"
        >
          Standard
        </Link>
        <Link 
          href="/hierarchy" 
          className="px-6 py-2 rounded-full text-sm font-medium transition-colors bg-[#2a2a2a] text-white shadow-sm"
        >
          Hierarchy
        </Link>
      </div>

      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-semibold text-[#FFFFFF] tracking-tight drop-shadow-md mb-1">Fliptop Battles 3D</h1>
          <p className="text-[#A3A3A3] text-sm drop-shadow-md">
            Interactive WebGL visualization of Emcees, Battles, and Events.
          </p>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-10 pointer-events-auto">
        <Link href="/admin" className="text-sm text-[#5E87C9] hover:text-[#7ba2e0] transition-colors bg-[#1a1a1a] border border-[#333] shadow-lg px-4 py-2 rounded-full backdrop-blur-sm">
          Admin Login &rarr;
        </Link>
      </div>

      <div className="w-full h-full">
        <GraphClient graphData={graphData} mode="Hierarchy" />
      </div>
    </div>
  );
}
