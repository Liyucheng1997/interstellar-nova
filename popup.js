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
            loadDomainDatabase();
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
    document.getElementById('clearDomainRules').addEventListener('click', clearDomainRules);
    document.getElementById('autoModeToggle').addEventListener('change', toggleAutoMode);

    const delaySlider = document.getElementById('delaySlider');
    if (delaySlider) {
        delaySlider.addEventListener('input', updateDelayDisplay);
        delaySlider.addEventListener('change', saveAutoDelay);
    }
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
    chrome.storage.local.get(['ai_provider', 'openai_api_key', 'gemini_api_key', 'settings'], (result) => {
        const provider = result.ai_provider || 'openai';
        document.getElementById('aiProvider').value = provider;

        const apiKeyField = provider === 'openai' ? 'openai_api_key' : 'gemini_api_key';
        if (result[apiKeyField]) {
            document.getElementById('apiKey').value = result[apiKeyField];
            showStatus('API密钥已配置 ✓', 'success');
        } else {
            document.getElementById('apiKey').value = '';
        }

        // 加载自动模式设置
        const settings = result.settings || {};
        const autoToggle = document.getElementById('autoModeToggle');
        if (autoToggle) {
            autoToggle.checked = !!settings.autoClassify;
            toggleDelaySlider(settings.autoClassify);
        }

        const delaySlider = document.getElementById('delaySlider');
        if (delaySlider) {
            const delay = settings.autoDelay || 60000;
            delaySlider.value = delay / 1000;
            updateDelayDisplay({ target: delaySlider });
        }

        updateHelpText(provider);
    });
}

// 切换自动模式
function toggleAutoMode(e) {
    const isAuto = e.target.checked;
    toggleDelaySlider(isAuto);

    chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || {};
        settings.autoClassify = isAuto;
        chrome.storage.local.set({ settings }, () => {
            console.log('自动分类模式:', isAuto ? '开启' : '关闭');
        });
    });
}

function toggleDelaySlider(enabled) {
    const container = document.getElementById('autoDelayContainer');
    if (container) {
        container.style.opacity = enabled ? '1' : '0.5';
        container.style.pointerEvents = enabled ? 'auto' : 'none';
        container.style.transition = 'opacity 0.3s';
    }
}

function updateDelayDisplay(e) {
    const seconds = parseInt(e.target.value);
    const display = document.getElementById('delayValue');
    if (display) {
        if (seconds < 60) {
            display.textContent = `${seconds}秒`;
        } else {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            display.textContent = secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
        }
    }
}

function saveAutoDelay(e) {
    const delayMs = e.target.value * 1000;
    chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || {};
        settings.autoDelay = delayMs;
        chrome.storage.local.set({ settings }, () => {
            console.log('自动分类延迟:', delayMs, 'ms');
        });
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

        // 检查是否为受限页面
        if (isRestrictedPage(tab.url)) {
            throw new Error('此页面无法分类（浏览器内置页面）');
        }

        await chrome.tabs.sendMessage(tab.id, { type: 'CLASSIFY_CURRENT_PAGE' });
        await waitForClassification(tab.url);
        showLatestResult(tab.url);
    } catch (error) {
        // 优化错误提示
        let message = error.message || '分类失败';
        if (message.includes('Receiving end does not exist') || message.includes('Could not establish connection')) {
            message = '此页面无法分类（请刷新页面后重试，或该页面不支持扩展）';
        }
        showError(message);
    } finally {
        btn.disabled = false;
        btnText.textContent = '开始分类';
        spinner.classList.add('hidden');
    }
}

// 检查是否为受限页面
function isRestrictedPage(url) {
    if (!url) return true;
    const restrictedPrefixes = [
        'chrome://',
        'chrome-extension://',
        'edge://',
        'about:',
        'file://',
        'devtools://',
        'chrome-search://'
    ];
    return restrictedPrefixes.some(prefix => url.startsWith(prefix));
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

    if (result.reason.includes('(已缓存)')) {
        showStatus('已存在分类记录 (无需AI)', 'success');
    }

    resultCard.classList.remove('hidden');
}

// 显示错误
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = `❌ ${message}`;
    errorEl.classList.remove('hidden');
}

// 加载域名分类库
function loadDomainDatabase() {
    chrome.storage.local.get(['domain_rules'], (result) => {
        displayDomainDatabase(result.domain_rules || {});
    });
}

// 显示域名分类库
function displayDomainDatabase(domainRules) {
    const domainList = document.getElementById('domainList');

    const entries = Object.entries(domainRules);
    if (entries.length === 0) {
        domainList.innerHTML = '<p class="empty-state">暂无缓存记录</p>';
        return;
    }

    // 按时间戳排序（最新的在前）
    entries.sort((a, b) => {
        const timeA = a[1].timestamp ? new Date(a[1].timestamp).getTime() : 0;
        const timeB = b[1].timestamp ? new Date(b[1].timestamp).getTime() : 0;
        return timeB - timeA;
    });

    domainList.innerHTML = entries.map(([domain, data]) => {
        // 兼容旧格式（直接存储category字符串）和新格式（对象）
        const category = typeof data === 'string' ? data : data.category;
        const timestamp = typeof data === 'object' && data.timestamp ? data.timestamp : null;
        const tagColor = getTagColor(category);
        const timeText = timestamp ? formatTime(timestamp) : '未知时间';

        return `
            <div class="domain-item" data-domain="${domain}">
              <div class="domain-info">
                <div class="domain-name" title="${domain}">${domain}</div>
                <div class="domain-meta">
                  <span class="category-badge" style="background: ${tagColor}; padding: 2px 8px; font-size: 10px;">${category}</span>
                  <span>${timeText}</span>
                </div>
              </div>
              <div class="domain-actions">
                <button class="btn-icon-small btn-reclassify" data-action="reclassify" data-domain="${domain}" title="重新识别">🔄</button>
                <button class="btn-icon-small btn-delete" data-action="delete" data-domain="${domain}" title="删除">🗑️</button>
              </div>
            </div>
        `;
    }).join('');

    // 使用事件委托绑定按钮点击事件
    domainList.querySelectorAll('.btn-reclassify').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const domain = e.target.dataset.domain;
            reclassifyDomain(domain);
        });
    });

    domainList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const domain = e.target.dataset.domain;
            deleteDomainRule(domain);
        });
    });
}

// 删除域名规则
function deleteDomainRule(domain) {
    if (!confirm(`确定要删除 ${domain} 的分类规则吗？\n删除后，该域名下的页面将重新调用AI识别。`)) {
        return;
    }

    chrome.storage.local.get(['domain_rules'], (result) => {
        const rules = result.domain_rules || {};
        delete rules[domain];
        chrome.storage.local.set({ domain_rules: rules }, () => {
            loadDomainDatabase();
            showStatus(`🗑️ 已删除: ${domain}`, 'success');
        });
    });
}

// 重新识别域名
async function reclassifyDomain(domain) {
    // 显示正在处理提示
    showStatus(`🔄 正在准备重新识别 ${domain}...`, 'info');

    // 获取当前打开的该域名的标签页
    const tabs = await chrome.tabs.query({});
    const matchingTab = tabs.find(tab => {
        try {
            const url = new URL(tab.url);
            return url.hostname === domain;
        } catch {
            return false;
        }
    });

    if (!matchingTab) {
        showStatus(`❌ 请先打开 ${domain} 的任意页面`, 'error');
        return;
    }

    // 先删除旧规则
    const result = await chrome.storage.local.get(['domain_rules']);
    const rules = result.domain_rules || {};
    delete rules[domain];
    await chrome.storage.local.set({ domain_rules: rules });

    showStatus(`🤖 正在调用AI重新识别 ${domain}...`, 'info');

    try {
        // 使用 chrome.scripting 直接注入脚本提取页面内容
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: matchingTab.id },
            func: () => {
                return {
                    title: document.title,
                    text: document.body.innerText.slice(0, 5000),
                    url: window.location.href
                };
            }
        });

        if (!injectionResults || !injectionResults[0] || !injectionResults[0].result) {
            showStatus(`❌ 无法获取页面内容`, 'error');
            return;
        }

        const pageData = injectionResults[0].result;

        // 发送给 background 处理分类
        chrome.runtime.sendMessage({
            type: 'CLASSIFY_PAGE',
            data: pageData
        }, (response) => {
            if (response && response.success) {
                loadDomainDatabase();
                showStatus(`✅ ${domain} 重新识别完成！分类: ${response.result.category}`, 'success');
            } else {
                showStatus(`❌ 识别失败: ${response?.error || '未知错误'}`, 'error');
            }
        });

    } catch (e) {
        showStatus(`❌ 识别失败: ${e.message}`, 'error');
    }
}

// 清空所有域名规则
function clearDomainRules() {
    if (confirm('确定要清空所有域名分类规则吗？\n清空后，所有页面将重新调用AI识别。')) {
        chrome.storage.local.set({ domain_rules: {} }, () => {
            loadDomainDatabase();
            document.getElementById('currentResult').classList.add('hidden');
            showStatus('域名分类库已清空', 'info');
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

// 暴露到全局作用域，供 onclick 事件调用
window.deleteDomainRule = deleteDomainRule;
window.reclassifyDomain = reclassifyDomain;
