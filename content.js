// 内容脚本：提取页面文本并发送给后台进行分类

console.log('AI分类扩展：Content script已加载');

// 监听来自popup的手动分类请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CLASSIFY_CURRENT_PAGE') {
    console.log('收到手动分类请求');
    classifyCurrentPage();
    sendResponse({ status: 'started' });
  }
  return true;
});

// 提取并分类当前页面
function classifyCurrentPage() {
  // 提取页面主要信息
  const pageData = extractPageData();
  
  // 检查是否有有效内容
  if (!pageData.text || pageData.text.trim().length < 50) {
    console.log('页面内容过少，跳过分类');
    return;
  }
  
  console.log('提取的页面数据:', {
    title: pageData.title,
    url: pageData.url,
    textLength: pageData.text.length
  });
  
  // 发送给后台服务进行分类
  chrome.runtime.sendMessage({
    type: 'CLASSIFY_PAGE',
    data: pageData
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('消息发送失败:', chrome.runtime.lastError);
      return;
    }
    
    if (response && response.success) {
      console.log('分类成功:', response.result);
      // 可以在页面上显示一个临时通知（可选）
      // showNotification(response.result);
    } else {
      console.error('分类失败:', response?.error || '未知错误');
    }
  });
}

// 提取页面数据
function extractPageData() {
  // 获取页面标题
  const title = document.title || '';
  
  // 获取页面URL
  const url = window.location.href;
  
  // 提取页面文本内容（优先提取主要内容区域）
  let text = '';
  
  // 尝试获取主要内容区域
  const mainContent = document.querySelector('main, article, .content, .main-content, #content');
  if (mainContent) {
    text = mainContent.innerText;
  } else {
    // 如果没有找到主要内容区域，使用整个body
    text = document.body.innerText;
  }
  
  // 清理文本：移除多余空白和换行
  text = text
    .replace(/\s+/g, ' ')  // 将多个空白字符替换为单个空格
    .trim();
  
  // 限制文本长度为4000字符（避免token超限）
  if (text.length > 4000) {
    text = text.slice(0, 4000);
  }
  
  return {
    title,
    url,
    text
  };
}

// 在页面上显示通知（可选功能）
function showNotification(result) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">✨ 页面已分类</div>
    <div>类别：${result.category}</div>
  `;
  
  document.body.appendChild(notification);
  
  // 3秒后自动移除
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
