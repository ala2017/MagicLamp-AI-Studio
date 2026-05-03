// 量子云图实现
export function initQuantumCloud() {
    const container = document.getElementById('quantum-cloud-viz');
    if (!container) {
        console.error('量子云图容器不存在');
        return;
    }

    // 等待容器尺寸准备就绪
    if (!container.clientWidth || !container.clientHeight) {
        requestAnimationFrame(() => initQuantumCloud());
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 清除已有内容
    d3.select(container).selectAll("*").remove();

    // 创建 SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);

    // 添加缩放功能
    const zoom = d3.zoom()
        .scaleExtent([0.5, 2])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // 创建主要的图形容器
    const g = svg.append("g");

    // 创建力导向图
    const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(30));

    // 获取书签数据并转换为图形数据
    chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
        try {
            const graphData = transformBookmarksToGraph(bookmarkTreeNodes[0]);
            
            // 创建连线
            const link = g.append("g")
                .attr("class", "links")
                .selectAll("line")
                .data(graphData.links)
                .enter()
                .append("line")
                .attr("class", "link")
                .attr("stroke", d => getLineColor(d))
                .attr("stroke-width", 1);

            // 创建节点
            const node = g.append("g")
                .attr("class", "nodes")
                .selectAll("g")
                .data(graphData.nodes)
                .enter()
                .append("g")
                .attr("class", "node")
                .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended));

            // 节点圆形背景
            node.append("circle")
                .attr("r", d => getNodeSize(d))
                .attr("fill", d => getNodeColor(d))
                .attr("stroke", d => getNodeBorderColor(d))
                .attr("stroke-width", 2);

            // 节点文本
            node.append("text")
                .text(d => d.title)
                .attr("dy", 4)
                .attr("text-anchor", "middle")
                .style("font-size", d => Math.max(8, 14 - d.depth) + "px");

            // 点击事件
            node.on("click", handleNodeClick);

            // 更新力导向图
            simulation
                .nodes(graphData.nodes)
                .on("tick", ticked);

            simulation.force("link")
                .links(graphData.links);

            // 力导向图更新函数
            function ticked() {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node
                    .attr("transform", d => `translate(${d.x},${d.y})`);
            }

            // 添加缩放控件
            addZoomControls(svg, zoom);

        } catch (error) {
            console.error('量子云图初始化失败:', error);
        }
    });

    // 处理节点点击
    function handleNodeClick(event, d) {
        // 阻止事件冒泡
        event.stopPropagation();
        
        // 移除其他节点的选中状态
        d3.selectAll(".node").classed("selected", false);
        // 添加当前节点的选中状态
        d3.select(this).classed("selected", true);
        
        // 移动到中心视角
        centerNode(d);
        
        // 如果是书签节点，打开链接
        if (d.url) {
            chrome.tabs.create({ url: d.url });
        }
    }

    // 拖拽相关函数
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    // 居中显示节点
    function centerNode(d) {
        const transform = d3.zoomTransform(svg.node());
        const scale = transform.k;
        const x = -d.x * scale + width / 2;
        const y = -d.y * scale + height / 2;
        
        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity
                .translate(x, y)
                .scale(scale)
            );
    }
}

// 添加缩放控件
function addZoomControls(svg, zoom) {
    const controls = d3.select("#quantum-cloud-viz")
        .append("div")
        .attr("class", "zoom-controls");

    controls.append("button")
        .attr("class", "zoom-btn zoom-in")
        .html("+")
        .on("click", () => {
            svg.transition()
                .duration(300)
                .call(zoom.scaleBy, 1.2);
        });

    controls.append("button")
        .attr("class", "zoom-btn zoom-out")
        .html("-")
        .on("click", () => {
            svg.transition()
                .duration(300)
                .call(zoom.scaleBy, 0.8);
        });
}

// 辅助函数
function getNodeColor(d) {
    const colors = ['#4263EB', '#34D399', '#FBBF24', '#3B82F6'];
    return colors[d.depth % colors.length];
}

function getNodeBorderColor(d) {
    const borderColors = ['#2E3A59', '#0F766E', '#92400E', '#1E40AF'];
    return borderColors[d.depth % borderColors.length];
}

function getLineColor(d) {
    return getNodeColor(d.source);
}

function getNodeSize(d) {
    const baseSize = 20;
    const depthReduction = 2;
    const minSize = 8;
    return Math.max(minSize, baseSize - (d.depth * depthReduction));
}

// 转换书签数据为图形数据
function transformBookmarksToGraph(root) {
    const nodes = [];
    const links = [];
    let id = 0;

    function traverse(node, parent) {
        const currentNode = {
            id: id++,
            title: node.title,
            url: node.url,
            depth: parent ? parent.depth + 1 : 0
        };
        
        nodes.push(currentNode);

        if (parent) {
            links.push({
                source: parent.id,
                target: currentNode.id
            });
        }

        if (node.children) {
            node.children.forEach(child => traverse(child, currentNode));
        }
    }

    traverse(root, null);
    return { nodes, links };
}