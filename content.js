// 内容脚本：提取页面文本并发送给后台进行分类

console.log('AI分类扩展：Content script已加载');

// 监听来自popup的手动分类请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CLASSIFY_CURRENT_PAGE') {
    console.log('收到手动分类请求');
    classifyCurrentPage();
    sendResponse({ status: 'started' });
    return true;
  }
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
// 监听自动分类提示
console.log('🔌 [Content] AI分类扩展已加载');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📩 [Content] 收到消息:', request.type);

  if (request.type === 'SHOW_AUTO_PROMPT') {
    console.log('🎯 [Content] 显示自动分类提示:', request.classification);
    showAutoPrompt(request.classification);
    sendResponse({ success: true });
  }
  return true; // 保持通道开放
});

function showAutoPrompt(classification) {
  // 检查是否已存在
  if (document.getElementById('ai-classify-prompt')) return;

  const prompt = document.createElement('div');
  prompt.id = 'ai-classify-prompt';
  prompt.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        background: white;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        font-family: system-ui, -apple-system, sans-serif;
        width: 300px;
        animation: slideIn 0.3s ease-out;
        border: 1px solid #eee;
        color: #333;
    `;

  const categoryColor = getCategoryColor(classification.category);

  prompt.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:600; font-size:14px; display:flex; align-items:center; gap:6px; color:#333;">
                ✨ AI 智能分类建议
            </span>
            <button id="ai-prompt-close" style="background:none; border:none; cursor:pointer; font-size:18px; color:#999; padding:0; line-height:1;">&times;</button>
        </div>
        <p style="font-size:13px; color:#555; margin:0 0 12px 0; line-height:1.5;">
            检测到当前页面属于 <strong style="color:${categoryColor}">${classification.category}</strong>，是否将其归类？
        </p>
        <div style="display:flex; gap:8px;">
            <button id="ai-prompt-confirm" style="flex:1; background:#667eea; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500; transition: background 0.2s;">
                确认归类
            </button>
            <button id="ai-prompt-dismiss" style="flex:1; background:#f5f5f5; color:#666; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:13px; transition: background 0.2s;">
                暂不需要
            </button>
        </div>
    `;

  document.body.appendChild(prompt);

  // Bind events
  const confirmBtn = document.getElementById('ai-prompt-confirm');
  const dismissBtn = document.getElementById('ai-prompt-dismiss');
  const closeBtn = document.getElementById('ai-prompt-close');

  confirmBtn.onmouseover = () => confirmBtn.style.background = '#5568d3';
  confirmBtn.onmouseout = () => confirmBtn.style.background = '#667eea';

  dismissBtn.onmouseover = () => dismissBtn.style.background = '#e0e0e0';
  dismissBtn.onmouseout = () => dismissBtn.style.background = '#f5f5f5';

  confirmBtn.onclick = () => {
    chrome.runtime.sendMessage({
      type: 'CONFIRM_AUTO_CLASSIFY',
      category: classification.category
    });
    removePrompt();
  };

  dismissBtn.onclick = removePrompt;
  closeBtn.onclick = removePrompt;

  function removePrompt() {
    prompt.style.opacity = '0';
    prompt.style.transform = 'translateY(-10px)';
    prompt.style.transition = 'all 0.3s';
    setTimeout(() => {
      if (prompt.parentNode) prompt.remove();
    }, 300);
  }
}

function getCategoryColor(category) {
  const colors = {
    '学习工作': '#1A73E8',
    '影视娱乐': '#9334E6',
    'AI工具': '#12B5CB',
    '购物消费': '#D93025',
    '社交媒体': '#E52592',
    '新闻阅读': '#5F6368',
    '技术开发': '#1E8E3E',
    '金融理财': '#E8710A',
    '生活日常': '#F9AB00',
    '其他分类': '#5F6368'
  };
  return colors[category] || '#667eea';
}
