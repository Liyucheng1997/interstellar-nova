// Popup界面逻辑

document.addEventListener('DOMContentLoaded', initPopup);

let isApiKeyVisible = false;

// 默认标签列表
const DEFAULT_TAGS = [
    '学习工作', '影视娱乐', 'AI工具', '购物消费',
    '社交媒体', '新闻阅读', '技术开发', '金融理财',
    '生活日常', '其他分类'
];

// 固定颜色映射 (使用Chrome标签组的真实颜色 - 深色版)
// Chrome支持: grey, blue, red, yellow, green, pink, purple, cyan, orange
const TAG_COLORS = {
    '学习工作': { chrome: 'blue', hex: '#1A73E8' },  // 蓝色
    '影视娱乐': { chrome: 'purple', hex: '#9334E6' },  // 紫色
    'AI工具': { chrome: 'cyan', hex: '#12B5CB' },  // 青色
    '购物消费': { chrome: 'red', hex: '#D93025' },  // 红色
    '社交媒体': { chrome: 'pink', hex: '#E52592' },  // 粉色
    '新闻阅读': { chrome: 'grey', hex: '#5F6368' },  // 灰色
    '技术开发': { chrome: 'green', hex: '#1E8E3E' },  // 绿色
    '金融理财': { chrome: 'orange', hex: '#E8710A' },  // 橙色
    '生活日常': { chrome: 'yellow', hex: '#F9AB00' },  // 黄色
    '其他分类': { chrome: 'grey', hex: '#5F6368' }   // 灰色
};

function initPopup() {
    checkInitState();
    bindEvents();
}

// 检查初始化状态
function checkInitState() {
    chrome.storage.local.get(['enabled_tags'], (result) => {
        if (result.enabled_tags && result.enabled_tags.length > 0) {
            showView('mainView');
            loadConfig();
            loadHistory();
            syncTabGroupColors();
        } else {
            showView('setupView');
            renderTagsGrid();
        }
    });
}

// 绑定事件
function bindEvents() {
    document.getElementById('enterMainBtn').addEventListener('click', saveTagsAndEnter);
    document.getElementById('openSettings').addEventListener('click', () => {
        showView('setupView');
        renderTagsGrid();
    });
    document.getElementById('aiProvider').addEventListener('change', onProviderChange);
    document.getElementById('toggleApiKey').addEventListener('click', toggleApiKeyVisibility);
    document.getElementById('saveApiKey').addEventListener('click', saveApiKey);
    document.getElementById('classifyBtn').addEventListener('click', classifyCurrentPage);
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
}

// 切换视图
function showView(viewId) {
    document.querySelectorAll('.view').forEach(el => {
        el.classList.add('hidden');
        el.style.opacity = '0';
    });
    const target = document.getElementById(viewId);
    target.classList.remove('hidden');
    setTimeout(() => { target.style.opacity = '1'; }, 10);
}

// 获取标签颜色 (固定颜色)
function getTagColor(tag) {
    return TAG_COLORS[tag]?.hex || '#9AA0A6';
}

// 渲染标签网格 - 简化版
function renderTagsGrid() {
    chrome.storage.local.get(['enabled_tags'], (result) => {
        const enabledTags = result.enabled_tags || DEFAULT_TAGS;
        const grid = document.getElementById('tagsGrid');

        grid.innerHTML = DEFAULT_TAGS.map(tag => {
            const isSelected = enabledTags.includes(tag);
            const tagColor = getTagColor(tag);

            return `
                <div class="tag-card ${isSelected ? 'selected' : ''}" 
                     data-tag="${tag}" 
                     style="${isSelected ? `border-color: ${tagColor}; background: ${tagColor}20;` : ''}">
                    <div class="tag-content">
                        <span class="tag-name">${tag}</span>
                    </div>
                </div>
            `;
        }).join('');

        // 点击事件
        document.querySelectorAll('.tag-card').forEach(card => {
            card.addEventListener('click', function () {
                this.classList.toggle('selected');
                const tag = this.getAttribute('data-tag');
                const tagColor = getTagColor(tag);
                if (this.classList.contains('selected')) {
                    this.style.borderColor = tagColor;
                    this.style.background = tagColor + '20';
                } else {
                    this.style.borderColor = '#ddd';
                    this.style.background = 'white';
                }
            });
        });
    });
}

// 保存标签并进入主界面
function saveTagsAndEnter() {
    const selectedElements = document.querySelectorAll('.tag-card.selected');
    const enabledTags = Array.from(selectedElements).map(el => el.getAttribute('data-tag'));

    if (enabledTags.length === 0) {
        alert('请至少选择一个标签');
        return;
    }

    chrome.storage.local.set({ enabled_tags: enabledTags }, () => {
        showView('mainView');
        loadConfig();
        loadHistory();
        syncTabGroupColors();
    });
}

// 同步标签组颜色
function syncTabGroupColors() {
    chrome.runtime.sendMessage({ type: 'SYNC_TAB_GROUP_COLORS' }, (response) => {
        if (response && response.success) {
            console.log('✅ 标签组颜色同步成功');
        }
    });
}

// 加载配置
function loadConfig() {
    chrome.storage.local.get(['ai_provider', 'openai_api_key', 'gemini_api_key'], (result) => {
        const provider = result.ai_provider || 'openai';
        document.getElementById('aiProvider').value = provider;

        const apiKeyField = provider === 'openai' ? 'openai_api_key' : 'gemini_api_key';
        if (result[apiKeyField]) {
            document.getElementById('apiKey').value = result[apiKeyField];
            showStatus('API密钥已配置 ✓', 'success');
        } else {
            document.getElementById('apiKey').value = '';
        }
        updateHelpText(provider);
    });
}

// 提供商变更
function onProviderChange() {
    const provider = document.getElementById('aiProvider').value;
    chrome.storage.local.get(['openai_api_key', 'gemini_api_key'], (result) => {
        const apiKeyField = provider === 'openai' ? 'openai_api_key' : 'gemini_api_key';
        const apiKey = result[apiKeyField] || '';
        document.getElementById('apiKey').value = apiKey;
        chrome.storage.local.set({ ai_provider: provider });
        updateHelpText(provider);
        if (apiKey) {
            showStatus('已切换到 ' + (provider === 'openai' ? 'OpenAI' : 'Gemini'), 'info');
        } else {
            showStatus('请配置 ' + (provider === 'openai' ? 'OpenAI' : 'Gemini') + ' API密钥', 'info');
        }
    });
}

// 更新帮助文本
function updateHelpText(provider) {
    const helpText = document.getElementById('apiHelpText');
    const link = document.getElementById('apiProviderLink');
    if (provider === 'openai') {
        link.href = 'https://platform.openai.com/api-keys';
        link.textContent = 'OpenAI平台';
    } else {
        link.href = 'https://aistudio.google.com/app/apikey';
        link.textContent = 'Google AI Studio';
    }
}

// 切换密钥可见性
function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('apiKey');
    isApiKeyVisible = !isApiKeyVisible;
    apiKeyInput.type = isApiKeyVisible ? 'text' : 'password';
}

// 保存API密钥
function saveApiKey() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const provider = document.getElementById('aiProvider').value;

    if (!apiKey) {
        showStatus('请输入API密钥', 'error');
        return;
    }

    const keyField = provider === 'openai' ? 'openai_api_key' : 'gemini_api_key';
    chrome.storage.local.set({ [keyField]: apiKey, ai_provider: provider }, () => {
        showStatus('API密钥已保存 ✓', 'success');
    });
}

// 显示状态
function showStatus(message, type) {
    const statusEl = document.getElementById('apiKeyStatus');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.opacity = '1';
    setTimeout(() => { statusEl.style.opacity = '0'; }, 3000);
}

// 分类当前页面
async function classifyCurrentPage() {
    const btn = document.getElementById('classifyBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    document.getElementById('errorMessage').classList.add('hidden');

    try {
        btn.disabled = true;
        btnText.textContent = '分析中...';
        spinner.classList.remove('hidden');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('无法获取当前标签页');

        await chrome.tabs.sendMessage(tab.id, { type: 'CLASSIFY_CURRENT_PAGE' });
        await waitForClassification(tab.url);
        showLatestResult(tab.url);
    } catch (error) {
        showError(error.message || '分类失败');
    } finally {
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
                if (latest && latest.url === url && Date.now() - new Date(latest.timestamp).getTime() < 5000) {
                    clearInterval(checkInterval);
                    resolve(latest);
                }
                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('分类超时'));
                }
            });
        }, 500);
    });
}

// 显示最新结果
function showLatestResult(url) {
    chrome.storage.local.get(['classifications'], (result) => {
        const latest = (result.classifications || []).find(c => c.url === url);
        if (latest) displayResult(latest);
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

    const tagColor = getTagColor(result.category);

    categoryBadge.textContent = result.category;
    categoryBadge.style.background = tagColor;
    categoryBadge.className = 'category-badge';

    confidenceBadge.textContent = getConfidenceText(result.confidence);
    confidenceBadge.className = `confidence-badge ${result.confidence}`;

    pageTitle.textContent = result.title || '无标题';
    categoryReason.textContent = result.reason;
    timestamp.textContent = `分类时间: ${formatTime(result.timestamp)}`;

    resultCard.classList.remove('hidden');
}

// 显示错误
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = `❌ ${message}`;
    errorEl.classList.remove('hidden');
}

// 加载历史记录
function loadHistory() {
    chrome.storage.local.get(['classifications'], (result) => {
        displayHistory(result.classifications || []);
    });
}

// 显示历史记录
function displayHistory(classifications) {
    const historyList = document.getElementById('historyList');

    if (classifications.length === 0) {
        historyList.innerHTML = '<p class="empty-state">暂无分类记录</p>';
        return;
    }

    historyList.innerHTML = classifications.slice(0, 10).map(item => {
        const tagColor = getTagColor(item.category);
        return `
            <div class="history-item">
              <div class="history-header">
                <span class="category-badge" style="background: ${tagColor};">${item.category}</span>
                <span class="history-time">${formatTime(item.timestamp)}</span>
              </div>
              <p class="history-title" title="${item.title}">${item.title}</p>
              <p class="history-url" title="${item.url}">${truncateUrl(item.url)}</p>
            </div>
        `;
    }).join('');
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

// 辅助函数
function getConfidenceText(confidence) {
    return { 'high': '高置信度', 'medium': '中等置信度', 'low': '低置信度' }[confidence] || '未知';
}

function formatTime(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function truncateUrl(url) {
    return url.length <= 50 ? url : url.slice(0, 47) + '...';
}
