import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink, InteractionMode } from '../types';

interface ForceGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  mode: InteractionMode;
  selectedNodeId: string | null;
  centralNodeId?: string;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
}

export const ForceGraph: React.FC<ForceGraphProps> = ({
  nodes,
  links,
  mode,
  selectedNodeId,
  centralNodeId,
  onNodeClick,
  onBackgroundClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // Fix: Provide initial value 'undefined' to useRef
  const prevCentralNodeIdRef = useRef<string | undefined>(undefined);

  // Refs for event handlers to avoid re-running simulation when handlers change
  const onNodeClickRef = useRef(onNodeClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
    onBackgroundClickRef.current = onBackgroundClick;
  }, [onNodeClick, onBackgroundClick]);

  // 1. Monitor container size
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // 2. Initialize Simulation & Groups
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || !svgRef.current) return;

    const { width, height } = dimensions;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);
    
    // Clear and setup base structure only if not exists (or we could clear always)
    svg.selectAll("*").remove(); 
    const mainGroup = svg.append("g");
    const linksLayer = mainGroup.append("g").attr("class", "links-layer");
    const nodesLayer = mainGroup.append("g").attr("class", "nodes-layer");
    
    // Add click handler to SVG
    svg.on("click", (event) => {
       if (event.target === svg.node() || event.target.tagName === 'g') {
         onBackgroundClickRef.current();
       }
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        mainGroup.attr("transform", event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Initialize simulation
    const simulation = d3.forceSimulation<GraphNode, GraphLink>()
      .force("link", d3.forceLink<GraphNode, GraphLink>().id(d => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("collide", d3.forceCollide(40))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force("x", d3.forceX(width / 2).strength(0.01))
      .force("y", d3.forceY(height / 2).strength(0.01));

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions.width, dimensions.height]); 


  // 3. Topology Update (Physics)
  useEffect(() => {
    if (!simulationRef.current || !svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    const linksLayer = svg.select(".links-layer");
    const nodesLayer = svg.select(".nodes-layer");
    const simulation = simulationRef.current;
    const { width, height } = dimensions;

    // --- LINKS ---
    const currentLinks = links.map(l => ({ ...l }));
    const currentNodes = nodes.map(n => ({ ...n }));

    // Preserve positions & Pin Central Node
    const oldNodesMap = new Map(simulation.nodes().map(n => [n.id, n]));
    currentNodes.forEach(n => {
      const old = oldNodesMap.get(n.id);
      if (old) {
        n.x = old.x;
        n.y = old.y;
        n.vx = old.vx;
        n.vy = old.vy;
        n.fx = old.fx;
        n.fy = old.fy;
      }
      
      // Pin Central Node Logic
      if (centralNodeId && n.id === centralNodeId) {
          n.fx = width / 2;
          n.fy = height / 2;
          // If it's a new node or jumping to center, set x/y directly to avoid flying
          if (!old || old.id !== centralNodeId) {
              n.x = width / 2;
              n.y = height / 2;
          }
      } else {
          // If this node was the previous central node, release it
          if (prevCentralNodeIdRef.current === n.id) {
              n.fx = null;
              n.fy = null;
          }
      }
    });
    
    // Update ref
    prevCentralNodeIdRef.current = centralNodeId;

    // LINK JOIN (Rendered in linksLayer)
    const link = linksLayer.selectAll<SVGLineElement, GraphLink>(".link")
      .data(currentLinks, d => d.id);

    link.exit().remove();

    const linkEnter = link.enter().append("line")
      .attr("class", "link")
      .attr("stroke-opacity", 0.8);

    const linkUpdate = linkEnter.merge(link)
      .attr("stroke-width", 1.5) // Uniform, narrow width
      .attr("stroke", d => d.color || "#94a3b8");

    // NODE JOIN (Rendered in nodesLayer)
    const node = nodesLayer.selectAll<SVGGElement, GraphNode>(".node")
      .data(currentNodes, d => d.id);

    node.exit().transition().duration(300).attr("r", 0).remove();

    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    nodeEnter.append("circle")
      .attr("r", 25)
      .attr("fill", d => d.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2); // Default width

    nodeEnter.append("text")
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .style("font-weight", "bold")
      .style("font-size", "14px")
      .style("pointer-events", "none")
      .text(d => d.initials);

    const nodeUpdate = nodeEnter.merge(node);
    
    // Update click handler using REF to avoid re-running this effect
    nodeUpdate.on("click", (event, d) => {
        event.stopPropagation();
        onNodeClickRef.current(d);
    });
    
    // Update visuals (Non-selection dependent)
    nodeUpdate.select("circle")
      .attr("fill", d => d.color);

    nodeUpdate.select("text")
      .text(d => d.initials);

    // Restart simulation
    simulation.nodes(currentNodes);
    (simulation.force("link") as d3.ForceLink<GraphNode, GraphLink>).links(currentLinks);
    simulation.alpha(0.5).restart();

    simulation.on("tick", () => {
      linkUpdate
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      nodeUpdate
        .attr("transform", d => {
          if (isNaN(d.x!) || isNaN(d.y!)) return null;
          return `translate(${d.x},${d.y})`
        });
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation?.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation?.alphaTarget(0);
      
      // If it's the central node, snap it back to center (or keep it pinned there)
      if (d.id === centralNodeId) {
          d.fx = width / 2;
          d.fy = height / 2;
          // Optionally animate transition back to center if we want to be fancy, 
          // but just setting fx/fy will let the simulation pull it there fast.
      } else {
          d.fx = null;
          d.fy = null;
      }
    }

  }, [nodes, links, dimensions, centralNodeId]); 

  // 4. Visual Update (Selection & Central Highlight)
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    
    // Update selection/central styling
    svg.selectAll<SVGCircleElement, GraphNode>(".node circle")
      .transition().duration(200)
      .attr("stroke", d => {
         if (d.id === selectedNodeId) return "#2563eb"; // Priority 1: Selection (Blue)
         if (d.id === centralNodeId) return "#eab308";  // Priority 2: Central (Gold/Yellow)
         return "#fff"; // Default: White
      })
      .attr("stroke-width", d => (d.id === selectedNodeId || d.id === centralNodeId) ? 4 : 2);

  }, [selectedNodeId, centralNodeId, nodes]);

  // 5. Auto-Center Camera on Central Node Change (Reset Zoom)
  useEffect(() => {
    if (!centralNodeId || !svgRef.current || !zoomRef.current || dimensions.width === 0) return;
    
    const svg = d3.select(svgRef.current);
    // Since we are pinning the central node to the center of the coordinate system,
    // we just need to reset the zoom to Identity to see it in the center of the viewport.
    svg.transition()
        .duration(750)
        .call(zoomRef.current.transform, d3.zoomIdentity);

  }, [centralNodeId, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-50 relative overflow-hidden cursor-move">
      <svg ref={svgRef} className="w-full h-full block touch-none" />
      {dimensions.width === 0 && (
         <div className="absolute inset-0 flex items-center justify-center text-slate-400">
           Lade Graph...
         </div>
      )}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded shadow text-xs text-slate-500 pointer-events-none border border-slate-200">
        Force-Directed Layout • {nodes.length} Nodes
      </div>
    </div>
  );
};