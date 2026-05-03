/**
 * 书签服务
 * 用于获取Chrome浏览器书签数据
 */

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  dateAdded?: number;
  path: string; // 书签在目录树中的路径
  domain?: string;
}

/**
 * 递归展平书签树结构
 */
const flattenBookmarks = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string = ''): Bookmark[] => {
  let bookmarks: Bookmark[] = [];

  nodes.forEach(node => {
    // 当前节点路径
    const currentPath = path ? `${path} / ${node.title}` : node.title;

    if (node.url) {
      // 是书签节点
      try {
        const url = new URL(node.url);
        bookmarks.push({
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
          path: currentPath,
          domain: url.hostname
        });
      } catch (error) {
        // 忽略无效URL
        console.warn('Invalid URL in bookmark:', node.title, node.url);
      }
    }

    // 处理子节点
    if (node.children) {
      bookmarks = bookmarks.concat(flattenBookmarks(node.children, currentPath));
    }
  });

  return bookmarks;
};

/**
 * 获取Chrome浏览器书签
 */
export const getBookmarks = async (): Promise<Bookmark[]> => {
  return new Promise((resolve) => {
    try {
      chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        const bookmarks = flattenBookmarks(bookmarkTreeNodes);
        resolve(bookmarks);
      });
    } catch (error) {
      console.error('获取书签失败:', error);
      resolve([]);
    }
  });
};

/**
 * 过滤无效书签
 */
export const filterValidBookmarks = (bookmarks: Bookmark[]): Bookmark[] => {
  return bookmarks.filter(bookmark => 
    bookmark.url && 
    bookmark.title && 
    bookmark.url.startsWith('http')
  );
};

/**
 * 按批次分割书签数组
 */
export const batchBookmarks = (bookmarks: Bookmark[], batchSize: number = 100): Bookmark[][] => {
  const batches: Bookmark[][] = [];
  for (let i = 0; i < bookmarks.length; i += batchSize) {
    batches.push(bookmarks.slice(i, i + batchSize));
  }
  return batches;
}; 