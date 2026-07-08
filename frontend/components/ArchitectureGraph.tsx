"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface GraphData {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string }[];
}

function getNodeColor(filename: string) {
  if (filename.endsWith(".py")) return "#7A9B7E";
  if (filename.match(/\.(jsx|tsx)$/)) return "#E8A33D";
  if (filename.match(/\.(js|ts)$/)) return "#C97064";
  if (filename.match(/\.(css|scss)$/)) return "#7B8EC8";
  if (filename.match(/\.(md|txt|json|yaml|yml|toml|cfg|ini|env)$/)) return "#52555C";
  return "#9EA1A8";
}

export default function ArchitectureGraph({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 520 });
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: 520,
      });
    }
  }, []);

  const connectionCount: Record<string, number> = {};
  data.edges.forEach((e) => {
    connectionCount[e.source] = (connectionCount[e.source] || 0) + 1;
    connectionCount[e.target] = (connectionCount[e.target] || 0) + 1;
  });

  const graphData = {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      name: n.label,
      fullPath: n.id,
      connections: connectionCount[n.id] || 0,
    })),
    links: data.edges.map((e) => ({ source: e.source, target: e.target })),
  };

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node);
    if (node) {
      const neighbors = new Set<string>();
      const links = new Set<string>();
      neighbors.add(node.id);
      graphData.links.forEach((l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        if (src === node.id || tgt === node.id) {
          neighbors.add(src);
          neighbors.add(tgt);
          links.add(`${src}-${tgt}`);
        }
      });
      setHighlightNodes(neighbors);
      setHighlightLinks(links);
    } else {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
    }
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode((prev: any) => prev?.id === node.id ? null : node);
  }, []);

  const FILE_TYPE_LEGEND = [
    { color: "#7A9B7E", label: ".py" },
    { color: "#E8A33D", label: ".jsx/.tsx" },
    { color: "#C97064", label: ".js/.ts" },
    { color: "#7B8EC8", label: ".css" },
    { color: "#52555C", label: "config/docs" },
  ];

  return (
    <div className="w-full rounded-lg border border-[#2A2C30] bg-[#0E0F11] overflow-hidden">
      <div ref={containerRef} className="relative">
        <ForceGraph2D
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#0E0F11"
          nodeLabel=""
          nodeColor={(node: any) => {
            const color = getNodeColor(node.name);
            if (highlightNodes.size === 0) return color;
            return highlightNodes.has(node.id) ? color : "#1F2023";
          }}
          nodeRelSize={4}
          nodeVal={(node: any) => Math.max(1, node.connections * 1.5 + 1)}
          linkColor={(link: any) => {
            const src = typeof link.source === "object" ? link.source.id : link.source;
            const tgt = typeof link.target === "object" ? link.target.id : link.target;
            const key = `${src}-${tgt}`;
            if (highlightLinks.size === 0) return "#2A2C30";
            return highlightLinks.has(key) ? "#E8A33D" : "#1A1C1F";
          }}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkWidth={(link: any) => {
            const src = typeof link.source === "object" ? link.source.id : link.source;
            const tgt = typeof link.target === "object" ? link.target.id : link.target;
            return highlightLinks.has(`${src}-${tgt}`) ? 2 : 1;
          }}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
            if (globalScale < 0.6) return;
            const label = node.name;
            const fontSize = Math.max(8, 10 / globalScale);
            ctx.font = `${fontSize}px monospace`;
            const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
            ctx.fillStyle = isHighlighted ? "#EDEAE3" : "#2A2C30";
            ctx.fillText(label, node.x + 7, node.y + 3);
          }}
        />

        {/* Hover tooltip */}
        {hoveredNode && (
          <div className="absolute top-3 left-3 bg-[#131416] border border-[#2A2C30] rounded-lg px-3 py-2 font-mono text-xs pointer-events-none">
            <p className="text-[#E8A33D]">{hoveredNode.name}</p>
            <p className="text-[#52555C] mt-0.5">{hoveredNode.fullPath}</p>
            <p className="text-[#7A9B7E] mt-0.5">{hoveredNode.connections} connection{hoveredNode.connections !== 1 ? "s" : ""}</p>
          </div>
        )}

        {/* Selected node panel */}
        {selectedNode && (
          <div className="absolute top-3 right-3 bg-[#131416] border border-[#E8A33D] rounded-lg px-3 py-2 font-mono text-xs max-w-[200px]">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[#E8A33D]">selected</p>
              <button onClick={() => setSelectedNode(null)} className="text-[#52555C] hover:text-[#EDEAE3]">✕</button>
            </div>
            <p className="text-[#EDEAE3] break-all">{selectedNode.fullPath}</p>
            <p className="text-[#7A9B7E] mt-1">{selectedNode.connections} import{selectedNode.connections !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-[#2A2C30]">
        <span className="text-[#52555C] font-mono text-[10px] uppercase tracking-wider">file type</span>
        {FILE_TYPE_LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="font-mono text-[10px] text-[#52555C]">{item.label}</span>
          </div>
        ))}
        <span className="text-[#52555C] font-mono text-[10px] ml-auto">node size = connections</span>
      </div>
    </div>
  );
}