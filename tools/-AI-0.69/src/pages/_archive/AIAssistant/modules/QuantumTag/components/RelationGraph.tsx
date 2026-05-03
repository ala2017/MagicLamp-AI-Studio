import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import styles from '../styles/RelationGraph.module.scss';
import { getTagColor } from '../utils/tagHelper';
import { Tag, Relation } from '../services/aiAnalysisService';

interface RelationGraphProps {
  tags: Tag[];
  relations: Relation[];
  selectedTags: string[];
  onTagClick: (tagId: string) => void;
}

// 节点类型定义
interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  weight: number;
  x?: number;
  y?: number;
}

// 连线类型定义
interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  weight: number;
}

/**
 * 关系图组件
 * 使用D3.js实现力导向图
 */
const RelationGraph: React.FC<RelationGraphProps> = ({ 
  tags, 
  relations, 
  selectedTags, 
  onTagClick 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  
  // 控制状态
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [zoom, setZoom] = useState<{scale: number, x: number, y: number}>({
    scale: 1,
    x: 0,
    y: 0
  });
  
  // 构建图数据
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !tags.length) return;
    
    // 清除之前的内容
    d3.select(svgRef.current).selectAll('*').remove();
    
    // 获取容器尺寸
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    // 创建节点和连线数据
    const nodes: Node[] = tags.map(tag => ({
      id: tag.id,
      label: tag.label,
      weight: tag.weight
    }));
    
    const links: Link[] = relations.map(relation => ({
      source: relation.source,
      target: relation.target,
      weight: relation.weight
    }));
    
    // 创建SVG元素
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    
    // 创建缩放行为
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        setZoom({
          scale: event.transform.k,
          x: event.transform.x,
          y: event.transform.y
        });
        
        g.attr('transform', event.transform);
      });
    
    svg.call(zoomBehavior);
    
    // 创建主要图形组
    const g = svg.append('g');
    
    // 创建连线
    const link = g.append('g')
      .attr('class', styles.links)
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', 'rgba(255, 255, 255, 0.2)')
      .attr('stroke-width', d => Math.sqrt(d.weight));
    
    // 创建节点组
    const node = g.append('g')
      .attr('class', styles.nodes)
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', styles.node)
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // 创建节点圆形
    node.append('circle')
      .attr('r', d => 10 + d.weight * 2)
      .attr('fill', d => {
        // 选中的节点使用高亮颜色
        return selectedTags.includes(d.id) 
          ? '#4F8FFE' 
          : `rgba(66, 99, 235, ${0.3 + d.weight / 20})`;
      });
    
    // 创建节点文本
    node.append('text')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .text(d => d.label)
      .attr('fill', 'white')
      .style('font-size', d => `${10 + d.weight}px`);
    
    // 添加点击事件
    node.on('click', (event, d) => {
      event.stopPropagation();
      if (!isDragging) {
        onTagClick(d.id);
      }
    });
    
    // 创建模拟
    const simulation = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => 20 + d.weight * 2));
    
    simulationRef.current = simulation;
    
    // 更新位置
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as Node).x || 0)
        .attr('y1', d => (d.source as Node).y || 0)
        .attr('x2', d => (d.target as Node).x || 0)
        .attr('y2', d => (d.target as Node).y || 0);
      
      node
        .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });
    
    // 拖拽开始
    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      setIsDragging(false);
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    // 拖拽中
    function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      setIsDragging(true);
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    // 拖拽结束
    function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      
      // 延迟重置拖拽状态，允许点击事件触发
      setTimeout(() => setIsDragging(false), 100);
    }
    
    // 清理
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [tags, relations, selectedTags, onTagClick]);
  
  // 当选中标签变化时高亮相关节点
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    
    // 更新节点颜色
    svg.selectAll('circle')
      .data(tags)
      .attr('fill', d => {
        return selectedTags.includes(d.id) 
          ? '#4F8FFE' 
          : `rgba(66, 99, 235, ${0.3 + d.weight / 20})`;
      });
    
    // 更新连线样式
    svg.selectAll('line')
      .data(relations)
      .attr('stroke', d => {
        const isRelated = 
          selectedTags.includes(d.source as string) || 
          selectedTags.includes(d.target as string);
        
        return isRelated 
          ? 'rgba(255, 255, 255, 0.8)' 
          : 'rgba(255, 255, 255, 0.2)';
      });
  }, [selectedTags, tags, relations]);

  return (
    <div className={styles.relationGraphContainer} ref={containerRef}>
      <svg ref={svgRef} className={styles.svg}></svg>
      
      {/* 控制按钮 */}
      <div className={styles.controls}>
        <button 
          className={styles.controlButton}
          onClick={() => {
            if (svgRef.current) {
              d3.select(svgRef.current)
                .transition()
                .duration(500)
                .call(
                  d3.zoom<SVGSVGElement, unknown>().transform as any, 
                  d3.zoomIdentity
                );
            }
          }}
          title="重置视图"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="white" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M9,9V15H15V9" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default RelationGraph; 