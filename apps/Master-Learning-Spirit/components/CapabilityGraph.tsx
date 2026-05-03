
import React, { useMemo } from 'react';
import { CapabilityNode, CapabilityState } from '../types';
// Added CheckCircle2 to imports
import { Target, Zap, Brain, CheckCircle2 } from 'lucide-react';

interface CapabilityGraphProps {
  nodes: CapabilityNode[];
  profile: Record<string, CapabilityState>;
  onNodeClick: (node: CapabilityNode) => void;
  activeNodeId?: string;
}

const CapabilityGraph: React.FC<CapabilityGraphProps> = ({ nodes, profile, onNodeClick, activeNodeId }) => {
  const layout = useMemo(() => {
    if (nodes.length === 0) return { positions: {}, links: [], viewSize: { width: 800, height: 600 } };

    const pos: Record<string, { x: number; y: number }> = {};
    const levels: Record<number, CapabilityNode[]> = {};
    
    nodes.forEach(node => {
      const lv = node.level || 1;
      if (!levels[lv]) levels[lv] = [];
      levels[lv].push(node);
    });

    const levelWidth = 340; 
    const nodeGapY = 160;   // 显著增加间距
    const maxNodesInLevel = Math.max(...Object.values(levels).map(l => l.length));
    
    const svgWidth = (Object.keys(levels).length) * levelWidth + 150;
    const svgHeight = maxNodesInLevel * nodeGapY + 200;

    Object.keys(levels).forEach(l => {
      const level = parseInt(l);
      const levelNodes = levels[level];
      const startY = (svgHeight - (levelNodes.length * nodeGapY)) / 2;
      
      levelNodes.forEach((node, i) => {
        pos[node.id] = {
          x: (level - 0.5) * levelWidth + 80,
          y: startY + i * nodeGapY + (nodeGapY / 2)
        };
      });
    });

    const links: { from: string; to: string }[] = [];
    nodes.forEach(node => {
      node.dependencies?.forEach(depId => {
        if (pos[depId]) links.push({ from: depId, to: node.id });
      });
    });

    return { positions: pos, links, viewSize: { width: svgWidth, height: svgHeight } };
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <div className="w-full h-full overflow-auto bg-[#F8FAFC] p-12 scrollbar-hide">
      <div className="relative mx-auto" style={{ width: layout.viewSize.width, height: layout.viewSize.height }}>
        <svg width={layout.viewSize.width} height={layout.viewSize.height} className="absolute inset-0 pointer-events-none">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#CBD5E1" />
            </marker>
          </defs>
          {layout.links.map((link, i) => {
            const start = layout.positions[link.from];
            const end = layout.positions[link.to];
            const cp1x = start.x + 120;
            const cp2x = end.x - 120;
            return (
              <path
                key={i}
                d={`M ${start.x} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${end.x} ${end.y}`}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="3"
                markerEnd="url(#arrow)"
              />
            );
          })}
        </svg>

        {nodes.map(node => {
          const pos = layout.positions[node.id];
          const isActive = activeNodeId === node.id;
          const mastery = profile[node.id]?.mastery_score || 0;
          const isMastered = mastery >= 0.8;

          return (
            <div
              key={node.id}
              onClick={() => onNodeClick(node)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-64 p-6 rounded-[28px] cursor-pointer transition-all duration-300 border shadow-md flex flex-col ${
                isActive 
                ? 'bg-indigo-600 border-indigo-400 scale-105 z-20 shadow-xl' 
                : isMastered ? 'bg-white border-emerald-500 hover:border-emerald-600' : 'bg-white border-slate-200 hover:border-indigo-400'
              }`}
              style={{ left: pos.x, top: pos.y }}
            >
              <div className="flex items-center gap-3 mb-4 shrink-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : 'bg-indigo-50'}`}>
                   {node.type === 'principle' ? <Brain size={18} className={isActive ? 'text-white' : 'text-indigo-600'} /> : 
                    node.type === 'procedure' ? <Zap size={18} className={isActive ? 'text-white' : 'text-amber-500'} /> : 
                    <Target size={18} className={isActive ? 'text-white' : 'text-indigo-500'} />}
                </div>
                <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${isMastered ? 'bg-emerald-500' : 'bg-indigo-400'}`}
                    style={{ width: `${mastery * 100}%` }}
                  />
                </div>
              </div>
              
              <h5 className={`text-[15px] font-black leading-snug break-words ${isActive ? 'text-white' : 'text-slate-800'}`}>
                {node.name}
              </h5>
              
              <div className="mt-3 flex justify-between items-center border-t border-white/10 pt-3">
                <span className={`text-[10px] font-black tracking-widest ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {isMastered ? '已胜任' : `认知度 ${Math.round(mastery * 100)}%`}
                </span>
                {/* Fixed: CheckCircle2 is now imported above */}
                {isMastered && <CheckCircle2 size={14} className="text-emerald-500" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CapabilityGraph;
