/**
 * 量子云图 - 书签可视化
 * 使用D3.js实现书签树的可视化展示
 */

// 全局变量
let bookmarkTree = null;
let simulation = null;
let svg = null;
let g = null;
let nodes = [];
let links = [];
let width = 0;
let height = 0;
let zoom = null;
let tooltip = null;
let maxDepth = 2; // 默认显示深度
let colorMap = new Map(); // 文件夹颜色映射
let expandedNodes = new Set(); // 存储已展开的节点ID
let defaultIcon = '../../assets/icons/bookmark.svg'; // 默认图标路径
let faviconCache = {}; // 图标缓存

// 基础颜色集合 - 16种鲜艳的基础颜色
const baseColors = [
    '#FF1744', // 鲜红色
    '#FF5252', // 亮红色
    '#FF4081', // 粉红色
    '#F06292', // 浅粉色
    '#9C27B0', // 紫色
    '#673AB7', // 深紫色
    '#3F51B5', // 靛蓝色
    '#2196F3', // 蓝色
    '#00BCD4', // 青色
    '#009688', // 蓝绿色
    '#4CAF50', // 绿色
    '#8BC34A', // 浅绿色
    '#CDDC39', // 酸橙色
    '#FFEB3B', // 黄色
    '#FFC107', // 琥珀色
    '#FF9800'  // 橙色
];

// 生成扩展颜色库
const folderColors = generateColorPalette();

/**
 * 生成扩展颜色库
 * @returns {Array} 扩展后的颜色数组
 */
function generateColorPalette() {
    const palette = [];
    
    // 对每个基础颜色生成变体
    baseColors.forEach(baseColor => {
        // 添加基础颜色本身
        palette.push(baseColor);
        
        // 转换为HSL以便创建变体
        const hsl = hexToHSL(baseColor);
        
        // 创建多个亮度变体
        for (let l = 30; l <= 70; l += 10) {
            if (Math.abs(l - hsl.l) > 5) { // 避免与原始颜色太相似
                palette.push(hslToHex(hsl.h, hsl.s, l));
            }
        }
        
        // 创建多个饱和度变体
        for (let s = 60; s <= 100; s += 10) {
            if (Math.abs(s - hsl.s) > 5) { // 避免与原始颜色太相似
                palette.push(hslToHex(hsl.h, s, hsl.l));
            }
        }
        
        // 创建多个色相变体
        const hueSteps = [5, 10, 15, 20, 25];
        hueSteps.forEach(step => {
            palette.push(hslToHex((hsl.h + step) % 360, hsl.s, hsl.l)); // 色相+step
            palette.push(hslToHex((hsl.h - step + 360) % 360, hsl.s, hsl.l)); // 色相-step
        });
        
        // 创建组合变体 (同时改变色相、饱和度和亮度)
        for (let hShift of [-15, 15]) {
            for (let sShift of [-10, 10]) {
                for (let lShift of [-10, 10]) {
                    const newH = (hsl.h + hShift + 360) % 360;
                    const newS = Math.max(50, Math.min(100, hsl.s + sShift));
                    const newL = Math.max(30, Math.min(70, hsl.l + lShift));
                    
                    // 确保新颜色与已有颜色有足够差异
                    const newColor = hslToHex(newH, newS, newL);
                    if (!palette.includes(newColor)) {
                        palette.push(newColor);
                    }
                }
            }
        }
    });
    
    // 确保颜色数量足够
    console.log(`生成了${palette.length}种颜色`);
    
    // 如果需要更多颜色，可以通过微调色相继续生成
    if (palette.length < 500) {
        const additionalColors = [];
        const existingColors = new Set(palette);
        
        // 从现有颜色中生成更多微妙变化的颜色
        palette.slice(0, 50).forEach(color => {
            const hsl = hexToHSL(color);
            
            for (let hShift = 1; hShift <= 4; hShift++) {
                const newH = (hsl.h + hShift + 360) % 360;
                const newColor = hslToHex(newH, hsl.s, hsl.l);
                
                if (!existingColors.has(newColor)) {
                    additionalColors.push(newColor);
                    existingColors.add(newColor);
                    
                    if (palette.length + additionalColors.length >= 500) {
                        break;
                    }
                }
            }
        });
        
        palette.push(...additionalColors);
    }
    
    console.log(`最终生成了${palette.length}种颜色`);
    return palette;
}

/**
 * 将十六进制颜色转换为HSL
 * @param {String} hex 十六进制颜色
 * @returns {Object} HSL颜色对象
 */
function hexToHSL(hex) {
    // 移除#号
    hex = hex.replace(/^#/, '');
    
    // 解析RGB值
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;
    
    // 找出最大和最小RGB值
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        // 灰色
        h = s = 0;
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        
        h = Math.round(h * 60);
    }
    
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    
    return { h, s, l };
}

/**
 * 将HSL颜色转换为十六进制
 * @param {Number} h 色相
 * @param {Number} s 饱和度
 * @param {Number} l 亮度
 * @returns {String} 十六进制颜色
 */
function hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('量子云图页面加载完成');
    
    // 初始化页面
    initPage();
    
    // 添加事件监听器
    addEventListeners();
    
    // 加载书签数据
    loadBookmarkData();
});

/**
 * 初始化页面
 */
function initPage() {
    console.log('初始化量子云图页面');
    
    // 创建工具提示元素
    tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    // 设置SVG容器
    const container = document.getElementById('cloud-map-canvas');
    width = container.clientWidth;
    height = container.clientHeight;
    
    // 创建SVG元素
    svg = d3.select('#cloud-map-canvas').append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .attr('style', 'max-width: 100%; height: auto;');
    
    // 添加缩放和平移功能
    zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoom);
    
    // 创建主图形容器
    g = svg.append('g');
    
    // 更新深度滑块显示
    document.getElementById('depth-value').textContent = maxDepth;
}

/**
 * 添加事件监听器
 */
function addEventListeners() {
    // 深度滑块
    const depthSlider = document.getElementById('depth-slider');
    depthSlider.addEventListener('input', (e) => {
        document.getElementById('depth-value').textContent = e.target.value;
    });
    
    depthSlider.addEventListener('change', (e) => {
        maxDepth = parseInt(e.target.value);
        updateVisualization();
    });
    
    // 缩放滑块
    const zoomSlider = document.getElementById('zoom-slider');
    zoomSlider.addEventListener('input', (e) => {
        const zoomValue = parseFloat(e.target.value);
        document.getElementById('zoom-value').textContent = zoomValue.toFixed(1);
        
        // 应用缩放
        svg.transition().duration(300).call(
            zoom.transform,
            d3.zoomIdentity.scale(zoomValue)
        );
    });
    
    // 重置视图按钮
    document.getElementById('reset-view-btn').addEventListener('click', () => {
        resetView();
    });
    
    // 展开全部按钮
    document.getElementById('expand-all-btn').addEventListener('click', () => {
        expandAllNodes();
    });
    
    // 折叠全部按钮
    document.getElementById('collapse-all-btn').addEventListener('click', () => {
        collapseAllNodes();
    });
    
    // 刷新数据按钮
    document.getElementById('refresh-data-btn').addEventListener('click', () => {
        loadBookmarkData();
    });
    
    // 窗口大小变化时重新调整
    window.addEventListener('resize', debounce(() => {
        resizeVisualization();
    }, 250));
}

/**
 * 加载书签数据
 */
function loadBookmarkData() {
    console.log('加载书签数据');
    
    // 显示加载遮罩
    document.getElementById('loading-overlay').style.display = 'flex';
    
    // 使用BookmarkHelper获取书签树
    if (window.BookmarkHelper && window.BookmarkHelper.getBookmarkTree) {
        window.BookmarkHelper.getBookmarkTree((tree) => {
            bookmarkTree = tree;
            console.log('书签树加载成功', bookmarkTree);
            
            // 处理数据并创建可视化
            processBookmarkData();
            
            // 隐藏加载遮罩
            document.getElementById('loading-overlay').style.display = 'none';
        });
    } else {
        console.error('BookmarkHelper不可用');
        // 隐藏加载遮罩
        document.getElementById('loading-overlay').style.display = 'none';
        
        // 显示错误消息
        if (window.NotificationHelper) {
            window.NotificationHelper.showError('无法加载书签数据，请刷新页面重试');
        } else {
            alert('无法加载书签数据，请刷新页面重试');
        }
    }
}

/**
 * 处理书签数据
 */
function processBookmarkData() {
    console.log('处理书签数据');
    
    if (!bookmarkTree || bookmarkTree.length === 0) {
        console.error('书签树为空');
        return;
    }
    
    // 重置颜色映射
    colorMap.clear();
    
    // 创建层次结构数据
    const hierarchyData = createHierarchyData(bookmarkTree[0]);
    
    // 创建可视化
    createVisualization(hierarchyData);
}

/**
 * 创建层次结构数据
 * @param {Object} rootNode 根节点
 * @returns {Object} 层次结构数据
 */
function createHierarchyData(rootNode) {
    // 创建根节点
    const root = {
        id: rootNode.id,
        title: rootNode.title || '书签栏',
        type: 'folder',
        children: []
    };
    
    // 递归处理子节点
    if (rootNode.children) {
        // 跳过"其他书签"文件夹
        const bookmarkBar = rootNode.children.find(child => child.id === '1');
        if (bookmarkBar && bookmarkBar.children) {
            processChildren(bookmarkBar.children, root.children, 1);
        }
    }
    
    return root;
}

/**
 * 递归处理子节点
 * @param {Array} children 子节点数组
 * @param {Array} targetArray 目标数组
 * @param {Number} depth 当前深度
 */
function processChildren(children, targetArray, depth) {
    children.forEach((child, index) => {
        const node = {
            id: child.id,
            title: child.title || '未命名',
            type: child.url ? 'bookmark' : 'folder',
            depth: depth
        };
        
        if (child.url) {
            node.url = child.url;
            // 使用与主页相同的图标获取方式
            node.favicon = getFaviconUrl(child.url);
        } else {
            // 为文件夹分配颜色
            if (!colorMap.has(child.id)) {
                // 使用更智能的颜色选择逻辑
                const colorIndex = getOptimalColorIndex(child.id, depth, index);
                colorMap.set(child.id, folderColors[colorIndex]);
            }
            node.color = colorMap.get(child.id);
            node.children = [];
            
            // 递归处理子文件夹
            if (child.children) {
                processChildren(child.children, node.children, depth + 1);
            }
        }
        
        targetArray.push(node);
    });
}

/**
 * 获取最优的颜色索引
 * @param {String} nodeId 节点ID
 * @param {Number} depth 节点深度
 * @param {Number} index 节点在同级中的索引
 * @returns {Number} 颜色索引
 */
function getOptimalColorIndex(nodeId, depth, index) {
    // 使用节点ID的哈希值作为基础
    let hashCode = 0;
    for (let i = 0; i < nodeId.length; i++) {
        hashCode = ((hashCode << 5) - hashCode) + nodeId.charCodeAt(i);
        hashCode |= 0; // 转换为32位整数
    }
    
    // 使用深度和索引进一步影响颜色选择
    // 这样同级的文件夹会获得不同的颜色，而不同深度的文件夹也会有差异
    const adjustedIndex = (Math.abs(hashCode) + depth * 17 + index * 31) % folderColors.length;
    
    return adjustedIndex;
}

/**
 * 获取网站图标URL
 * @param {String} url 网站URL
 * @returns {String} 图标URL
 */
function getFaviconUrl(url) {
    try {
        // 尝试从缓存获取
        if (faviconCache[url]) {
            return faviconCache[url];
        }
        
        // 尝试从CacheManager获取
        if (window.CacheManager) {
            const cachedFavicons = window.CacheManager.getFaviconCache() || {};
            if (cachedFavicons[url]) {
                faviconCache[url] = cachedFavicons[url];
                return cachedFavicons[url];
            }
        }
        
        // 如果没有缓存，使用Google的favicon服务
        const domain = new URL(url).hostname;
        const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        
        // 保存到本地缓存
        faviconCache[url] = iconUrl;
        
        // 如果可用，保存到CacheManager
        if (window.CacheManager) {
            const cachedFavicons = window.CacheManager.getFaviconCache() || {};
            cachedFavicons[url] = iconUrl;
            window.CacheManager.setFaviconCache(cachedFavicons);
        }
        
        return iconUrl;
    } catch (error) {
        console.error('获取图标URL失败:', error);
        return defaultIcon;
    }
}

/**
 * 创建可视化
 * @param {Object} hierarchyData 层次结构数据
 */
function createVisualization(hierarchyData) {
    console.log('创建可视化');
    
    // 清除现有内容
    g.selectAll('*').remove();
    
    // 创建力导向图数据
    const { nodes: graphNodes, links: graphLinks } = createForceGraphData(hierarchyData);
    nodes = graphNodes;
    links = graphLinks;
    
    // 创建力导向模拟
    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide().radius(d => d.type === 'folder' ? 50 : 25))
        .on('tick', ticked);
    
    // 绘制连接线
    const link = g.append('g')
        .attr('class', 'links')
        .selectAll('path')
        .data(links)
        .enter().append('path')
        .attr('class', 'link')
        .style('stroke', d => d.source.color || '#555');
    
    // 绘制节点
    const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('.node')
        .data(nodes)
        .enter().append('g')
        .attr('class', d => `node ${d.type}${d.expanded ? ' expanded' : ''}`)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // 添加节点圆形
    node.append('circle')
        .attr('r', d => d.type === 'folder' ? 18 : 10)
        .style('fill', d => d.color || (d.type === 'folder' ? '#4285F4' : '#34A853'))
        .style('cursor', 'pointer')
        .style('display', d => d.type === 'bookmark' ? 'none' : null); // 书签节点隐藏圆形
    
    // 为书签节点添加半透明背景
    node.filter(d => d.type === 'bookmark')
        .append('rect')
        .attr('width', 24)
        .attr('height', 24)
        .attr('x', -12)
        .attr('y', -12)
        .attr('rx', 4)
        .attr('fill', 'rgba(255, 255, 255, 0.15)')
        .attr('class', 'bookmark-bg')
        .style('cursor', 'pointer');
    
    // 为书签节点添加图标
    node.filter(d => d.type === 'bookmark')
        .append('image')
        .attr('xlink:href', d => {
            // 如果有favicon，直接使用
            if (d.favicon && d.favicon !== defaultIcon) {
                return d.favicon;
            }
            
            // 使用默认图标
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMzRBODUzIiByeD0iNCIvPjwvc3ZnPg==';
        })
        .attr('width', 20)
        .attr('height', 20)
        .attr('x', -10)
        .attr('y', -10)
        .attr('class', 'bookmark-icon')
        .style('cursor', 'pointer');
    
    // 添加节点文本
    node.append('text')
        .attr('dy', 30)
        .text(d => truncateText(d.title, 20))
        .style('text-anchor', 'middle');
    
    // 添加节点交互
    node.on('click', nodeClicked)
        .on('mouseover', nodeMouseOver)
        .on('mouseout', nodeMouseOut);
    
    // 更新视图
    resetView();
    
    // 更新函数
    function ticked() {
        link.attr('d', d => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
        });
        
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    }
}

/**
 * 创建力导向图数据
 * @param {Object} hierarchyData 层次结构数据
 * @returns {Object} 包含节点和连接的对象
 */
function createForceGraphData(hierarchyData) {
    const graphNodes = [];
    const graphLinks = [];
    
    // 递归处理节点
    function processNode(node, parent = null, currentDepth = 1, parentExpanded = false) {
        // 检查当前节点是否应该展开
        const isExpanded = expandedNodes.has(node.id);
        
        // 添加当前节点
        const graphNode = {
            id: node.id,
            title: node.title,
            type: node.type,
            depth: node.depth,
            expanded: isExpanded,
            // 如果当前深度小于等于最大深度，或者父节点已展开，则节点可见
            visible: currentDepth <= maxDepth || parentExpanded
        };
        
        if (node.url) {
            graphNode.url = node.url;
            graphNode.favicon = node.favicon;
        }
        
        if (node.color) {
            graphNode.color = node.color;
        }
        
        graphNodes.push(graphNode);
        
        // 添加与父节点的连接
        if (parent) {
            graphLinks.push({
                source: parent.id,
                target: node.id,
                value: 1
            });
        }
        
        // 递归处理子节点
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                processNode(child, graphNode, currentDepth + 1, isExpanded);
            });
        }
    }
    
    // 从根节点开始处理
    processNode(hierarchyData);
    
    // 过滤不可见的节点和连接
    const visibleNodes = graphNodes.filter(node => node.visible);
    const visibleLinks = graphLinks.filter(link => {
        const sourceNode = graphNodes.find(n => n.id === link.source);
        const targetNode = graphNodes.find(n => n.id === link.target);
        return sourceNode && targetNode && sourceNode.visible && targetNode.visible;
    });
    
    return { nodes: visibleNodes, links: visibleLinks };
}

/**
 * 节点点击事件处理
 * @param {Event} event 事件对象
 * @param {Object} d 节点数据
 */
function nodeClicked(event, d) {
    if (d.type === 'bookmark') {
        // 打开书签链接
        window.open(d.url, '_blank');
        return;
    }
    
    // 切换文件夹展开状态
    d.expanded = !d.expanded;
    
    // 更新expandedNodes集合
    if (d.expanded) {
        expandedNodes.add(d.id);
    } else {
        expandedNodes.delete(d.id);
    }
    
    // 更新节点样式
    d3.select(this).classed('expanded', d.expanded);
    
    // 更新可视化
    updateVisualization();
}

/**
 * 节点鼠标悬停事件
 * @param {Event} event 事件对象
 * @param {Object} d 节点数据
 */
function nodeMouseOver(event, d) {
    // 显示工具提示
    tooltip.transition()
        .duration(200)
        .style('opacity', 0.9);
    
    let tooltipContent = `<div class="title">${d.title}</div>`;
    if (d.url) {
        tooltipContent += `<div class="url">${d.url}</div>`;
    }
    
    tooltip.html(tooltipContent)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    
    // 高亮相关连接
    d3.selectAll('.link')
        .style('stroke-opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 0.8 : 0.2)
        .style('stroke-width', l => (l.source.id === d.id || l.target.id === d.id) ? '2.5px' : '1px');
}

/**
 * 节点鼠标离开事件
 */
function nodeMouseOut() {
    // 隐藏工具提示
    tooltip.transition()
        .duration(500)
        .style('opacity', 0);
    
    // 恢复连接样式
    d3.selectAll('.link')
        .style('stroke-opacity', 0.4)
        .style('stroke-width', '1.5px');
}

/**
 * 拖拽开始事件
 * @param {Event} event 事件对象
 * @param {Object} d 节点数据
 */
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

/**
 * 拖拽中事件
 * @param {Event} event 事件对象
 * @param {Object} d 节点数据
 */
function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

/**
 * 拖拽结束事件
 * @param {Event} event 事件对象
 * @param {Object} d 节点数据
 */
function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

/**
 * 更新可视化
 */
function updateVisualization() {
    console.log('更新可视化');
    
    if (!bookmarkTree || bookmarkTree.length === 0) {
        return;
    }
    
    // 重新创建层次结构数据
    const hierarchyData = createHierarchyData(bookmarkTree[0]);
    
    // 重新创建可视化
    createVisualization(hierarchyData);
}

/**
 * 重置视图
 */
function resetView() {
    // 重置缩放
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.scale(1)
    );
    
    // 重置缩放滑块
    document.getElementById('zoom-slider').value = 1;
    document.getElementById('zoom-value').textContent = '1.0';
}

/**
 * 展开所有节点
 */
function expandAllNodes() {
    // 更新所有文件夹节点的展开状态
    nodes.forEach(node => {
        if (node.type === 'folder') {
            node.expanded = true;
            expandedNodes.add(node.id); // 添加到展开节点集合
        }
    });
    
    // 更新节点样式
    d3.selectAll('.node.folder').classed('expanded', true);
    
    // 更新可视化
    updateVisualization();
}

/**
 * 折叠所有节点
 */
function collapseAllNodes() {
    // 更新所有文件夹节点的展开状态
    nodes.forEach(node => {
        if (node.type === 'folder') {
            node.expanded = false;
            expandedNodes.delete(node.id); // 从展开节点集合中移除
        }
    });
    
    // 清空展开节点集合
    expandedNodes.clear();
    
    // 更新节点样式
    d3.selectAll('.node.folder').classed('expanded', false);
    
    // 更新可视化
    updateVisualization();
}

/**
 * 调整可视化大小
 */
function resizeVisualization() {
    console.log('调整可视化大小');
    
    const container = document.getElementById('cloud-map-canvas');
    width = container.clientWidth;
    height = container.clientHeight;
    
    // 更新SVG尺寸
    svg.attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height]);
    
    // 更新力导向图中心
    if (simulation) {
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.3).restart();
    }
}

/**
 * 截断文本
 * @param {String} text 原始文本
 * @param {Number} maxLength 最大长度
 * @returns {String} 截断后的文本
 */
function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * 防抖函数
 * @param {Function} func 要执行的函数
 * @param {Number} wait 等待时间
 * @returns {Function} 防抖处理后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
} 