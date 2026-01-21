// Popup界面逻辑

document.addEventListener('DOMContentLoaded', initPopup);

let isApiKeyVisible = false;

function initPopup() {
    // 加载配置
    loadConfig();

    // 加载历史记录
    loadHistory();

    // 绑定事件监听
    document.getElementById('aiProvider').addEventListener('change', onProviderChange);
    document.getElementById('toggleApiKey').addEventListener('click', toggleApiKeyVisibility);
    document.getElementById('saveApiKey').addEventListener('click', saveApiKey);
    document.getElementById('classifyBtn').addEventListener('click', classifyCurrentPage);
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
}

// 加载配置
function loadConfig() {
    chrome.storage.local.get(['ai_provider', 'openai_api_key', 'gemini_api_key'], (result) => {
        // 设置提供商选择
        const provider = result.ai_provider || 'openai';
        document.getElementById('aiProvider').value = provider;

        // 加载对应的API密钥
        const apiKeyField = provider === 'openai' ? 'openai_api_key' : 'gemini_api_key';
        if (result[apiKeyField]) {
            document.getElementById('apiKey').value = result[apiKeyField];
            showStatus('API密钥已配置 ✓', 'success');
        } else {
            document.getElementById('apiKey').value = '';
        }

        // 更新帮助文本
        updateHelpText(provider);
    });
}

// 提供商变更处理
function onProviderChange() {
    const provider = document.getElementById('aiProvider').value;

    // 加载对应的API密钥
    chrome.storage.local.get(['openai_api_key', 'gemini_api_key'], (result) => {
        const apiKeyField = provider === 'openai' ? 'openai_api_key' : 'gemini_api_key';
        document.getElementById('apiKey').value = result[apiKeyField] || '';

        // 更新帮助文本
        updateHelpText(provider);

        // 保存提供商选择
        chrome.storage.local.set({ ai_provider: provider });
    });
}

// 更新帮助文本
function updateHelpText(provider) {
    const link = document.getElementById('apiProviderLink');
    if (provider === 'openai') {
        link.textContent = 'OpenAI平台';
        link.href = 'https://platform.openai.com/api-keys';
    } else {
        link.textContent = 'Google AI Studio';
        link.href = 'https://aistudio.google.com/app/apikey';
    }
}

// 切换API密钥可见性
function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKey');
    isApiKeyVisible = !isApiKeyVisible;
    input.type = isApiKeyVisible ? 'text' : 'password';
    document.getElementById('toggleApiKey').textContent = isApiKeyVisible ? '🙈' : '👁️';
}

// 保存API密钥
function saveApiKey() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const provider = document.getElementById('aiProvider').value;

    if (!apiKey) {
        showStatus('请输入有效的API密钥', 'error');
        return;
    }

    const apiKeyField = provider === 'openai' ? 'openai_api_key' : 'gemini_api_key';
    chrome.storage.local.set({
        [apiKeyField]: apiKey,
        ai_provider: provider
    }, () => {
        showStatus('API密钥已保存 ✓', 'success');
    });
}

// 显示状态消息
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('apiKeyStatus');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;

    // 3秒后淡出
    setTimeout(() => {
        statusEl.className = 'status-message';
    }, 3000);
}

// 分类当前页面
async function classifyCurrentPage() {
    const btn = document.getElementById('classifyBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    const errorMessage = document.getElementById('errorMessage');
    const currentResult = document.getElementById('currentResult');

    // 隐藏之前的错误和结果
    errorMessage.classList.add('hidden');
    currentResult.classList.add('hidden');

    // 显示加载状态
    btn.disabled = true;
    btnText.textContent = '分析中...';
    spinner.classList.remove('hidden');

    try {
        // 获取当前活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('无法获取当前标签页');
        }

        // 向content script发送分类请求
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'CLASSIFY_CURRENT_PAGE'
        });

        // 等待分类完成（监听存储变化）
        await waitForClassification(tab.url);

        // 重新加载历史记录
        loadHistory();

        // 显示最新的分类结果
        showLatestResult(tab.url);

    } catch (error) {
        console.error('分类失败:', error);
        showError(error.message || '分类失败，请检查API密钥配置');
    } finally {
        // 恢复按钮状态
        btn.disabled = false;
        btnText.textContent = '开始分类';
        spinner.classList.add('hidden');
    }
}

// 等待分类完成
function waitForClassification(url, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkInterval = setInterval(() => {
            chrome.storage.local.get(['classifications'], (result) => {
                const classifications = result.classifications || [];
                const latest = classifications[0];

                // 检查是否有新的分类结果
                if (latest && latest.url === url && Date.now() - new Date(latest.timestamp).getTime() < 5000) {
                    clearInterval(checkInterval);
                    resolve(latest);
                }

                // 超时检查
                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('分类超时，请重试'));
                }
            });
        }, 500);
    });
}

// 显示最新的分类结果
function showLatestResult(url) {
    chrome.storage.local.get(['classifications'], (result) => {
        const classifications = result.classifications || [];
        const latest = classifications.find(c => c.url === url);

        if (latest) {
            displayResult(latest);
        }
    });
}

// 显示分类结果
function displayResult(result) {
    const resultCard = document.getElementById('currentResult');
    const categoryBadge = document.getElementById('categoryBadge');
    const confidenceBadge = document.getElementById('confidenceBadge');
    const pageTitle = document.getElementById('pageTitle');
    const categoryReason = document.getElementById('categoryReason');
    const timestamp = document.getElementById('timestamp');

    categoryBadge.textContent = result.category;
    categoryBadge.className = `category-badge ${getCategoryClass(result.category)}`;

    confidenceBadge.textContent = getConfidenceText(result.confidence);
    confidenceBadge.className = `confidence-badge ${result.confidence}`;

    pageTitle.textContent = result.title || '无标题';
    categoryReason.textContent = result.reason;
    timestamp.textContent = `分类时间: ${formatTime(result.timestamp)}`;

    resultCard.classList.remove('hidden');
}

// 显示错误消息
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = `❌ ${message}`;
    errorEl.classList.remove('hidden');
}

// 加载历史记录
function loadHistory() {
    chrome.storage.local.get(['classifications'], (result) => {
        const classifications = result.classifications || [];
        displayHistory(classifications);
    });
}

// 显示历史记录
function displayHistory(classifications) {
    const historyList = document.getElementById('historyList');

    if (classifications.length === 0) {
        historyList.innerHTML = '<p class="empty-state">暂无分类记录</p>';
        return;
    }

    // 只显示最近10条
    const recentItems = classifications.slice(0, 10);

    historyList.innerHTML = recentItems.map(item => `
    <div class="history-item">
      <div class="history-header">
        <span class="category-badge ${getCategoryClass(item.category)}">${item.category}</span>
        <span class="history-time">${formatTime(item.timestamp)}</span>
      </div>
      <p class="history-title" title="${item.title}">${item.title}</p>
      <p class="history-url" title="${item.url}">${truncateUrl(item.url)}</p>
    </div>
  `).join('');
}

// 清空历史记录
function clearHistory() {
    if (confirm('确定要清空所有历史记录吗？')) {
        chrome.storage.local.set({ classifications: [] }, () => {
            loadHistory();
            document.getElementById('currentResult').classList.add('hidden');
            showStatus('历史记录已清空', 'info');
        });
    }
}

// 获取分类对应的CSS类
function getCategoryClass(category) {
    const classMap = {
        '新闻资讯': 'news',
        '技术文档': 'tech',
        '娱乐休闲': 'entertainment',
        '电商购物': 'shopping',
        '社交媒体': 'social',
        '教育学习': 'education',
        '生活服务': 'life',
        '其他': 'other'
    };
    return classMap[category] || 'other';
}

// 获取置信度文本
function getConfidenceText(confidence) {
    const textMap = {
        'high': '高置信度',
        'medium': '中等置信度',
        'low': '低置信度'
    };
    return textMap[confidence] || '未知';
}

// 格式化时间
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60000) {
        return '刚刚';
    }

    // 小于1小时
    if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`;
    }

    // 小于1天
    if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`;
    }

    // 显示日期
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 截断URL
function truncateUrl(url) {
    if (url.length <= 50) return url;
    return url.slice(0, 47) + '...';
}
