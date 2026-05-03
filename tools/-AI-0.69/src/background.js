// 记录后台脚本启动
console.log('神灯AI书签管理器后台脚本已启动', new Date().toISOString());

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(() => {
  console.log('扩展图标被点击');
  // 打开新标签页
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/pages/home/home.html')
  });
});

// 统一的消息处理监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('后台脚本收到消息:', request);
  
  // 处理链接检查请求
  if (request.action === 'checkLink') {
    const url = request.url;
    console.log('后台脚本接收到链接检查请求:', url);
    
    // 使用XMLHttpRequest代替fetch
    const xhr = new XMLHttpRequest();
    let isDone = false;
    
    // 设置超时
    const timeoutId = setTimeout(() => {
      if (!isDone) {
        console.log('请求超时:', url);
        isDone = true;
        xhr.abort();
        sendResponse({
          url: url,
          error: '请求超时',
          status: 0,
          ok: false
        });
      }
    }, 10000);
    
    // 设置完成回调
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && !isDone) {
        isDone = true;
        clearTimeout(timeoutId);
        
        if (xhr.status >= 200 && xhr.status < 400) {
          console.log('请求成功:', url, xhr.status);
          sendResponse({
            url: url,
            status: xhr.status,
            ok: true,
            statusText: xhr.statusText || getStatusText(xhr.status)
          });
        } else {
          console.log('请求失败:', url, xhr.status);
          sendResponse({
            url: url,
            status: xhr.status || 0,
            ok: false,
            statusText: xhr.statusText || getStatusText(xhr.status)
          });
        }
      }
    };
    
    // 设置错误处理
    xhr.onerror = function(error) {
      if (!isDone) {
        isDone = true;
        clearTimeout(timeoutId);
        console.error('请求错误:', url, error);
        sendResponse({
          url: url,
          error: '网络错误',
          status: 0,
          ok: false
        });
      }
    };
    
    // 发送请求
    try {
      xhr.open('HEAD', url, true);
      xhr.send();
    } catch (error) {
      if (!isDone) {
        isDone = true;
        clearTimeout(timeoutId);
        console.error('请求异常:', url, error);
        sendResponse({
          url: url,
          error: error.message || '请求异常',
          status: 0,
          ok: false
        });
      }
    }
    
    return true; // 保持连接打开，以便异步发送响应
  }
  
  // 处理API请求
  if (request.type === 'API_REQUEST' || request.type === 'PROXY_REQUEST') {
    const { url, method, headers, body } = request.data;
    console.log('后台脚本接收到API请求:', url, method);
    
    // 创建AbortController用于请求超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error('API请求超时:', url);
      sendResponse({ 
        error: '请求超时，服务器响应时间过长',
        status: 408
      });
    }, 15000);
    
    // 使用立即执行的异步函数包装fetch操作
    (async () => {
      try {
        const response = await fetch(url, {
          method: method,
          headers: headers,
          body: body,
          signal: controller.signal
        });
        
        // 清除超时计时器
        clearTimeout(timeoutId);
        
        // 记录响应状态
        console.log('API响应状态:', response.status, response.statusText);
        
        // 准备响应对象
        let result = { 
          ok: response.ok, 
          status: response.status 
        };
        
        // 尝试解析响应体
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await response.json();
            result.data = data;
          } catch (error) {
            console.error('解析JSON响应失败:', error);
            result.error = '无法解析JSON响应';
          }
        } else {
          try {
            const text = await response.text();
            result.data = text;
          } catch (error) {
            console.error('读取响应文本失败:', error);
            result.error = '无法读取响应内容';
          }
        }
        
        // 发送响应
        if (result.ok) {
          console.log('API请求成功:', url);
          sendResponse({ 
            success: true, 
            data: result.data,
            status: result.status
          });
        } else {
          console.error('API请求失败:', url, result.status);
          
          // 提取错误信息
          let errorMessage = '请求失败';
          if (result.data && typeof result.data === 'object') {
            // 尝试从常见的API错误响应格式中提取错误信息
            errorMessage = result.data.error?.message || 
                          result.data.error || 
                          result.data.message || 
                          `HTTP错误: ${result.status}`;
          } else if (typeof result.data === 'string' && result.data) {
            errorMessage = result.data.substring(0, 100); // 限制错误消息长度
          } else {
            errorMessage = `HTTP错误: ${result.status} ${getStatusText(result.status)}`;
          }
          
          sendResponse({ 
            error: errorMessage,
            status: result.status
          });
        }
      } catch (error) {
        // 清除超时计时器
        clearTimeout(timeoutId);
        console.error('API请求异常:', url, error);
        
        // 处理不同类型的错误
        let errorMessage = error.message || '未知错误';
        let errorStatus = 0;
        
        if (error.name === 'AbortError') {
          errorMessage = '请求超时，服务器响应时间过长';
          errorStatus = 408;
        } else if (errorMessage.includes('NetworkError')) {
          errorMessage = '网络错误，请检查您的网络连接';
          errorStatus = 0;
        } else if (errorMessage.includes('CORS')) {
          errorMessage = '跨域请求被阻止，请确认API访问权限';
          errorStatus = 0;
        }
        
        sendResponse({ 
          error: errorMessage,
          status: errorStatus
        });
      }
    })();
    
    return true; // 保持消息通道打开
  }
  
  return false;
});

// 获取HTTP状态码对应的文本
function getStatusText(status) {
  const statusTexts = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };
  return statusTexts[status] || 'Unknown Status';
} 