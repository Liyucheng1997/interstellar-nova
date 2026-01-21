// 后台服务工作者：处理AI分类请求

console.log('AI分类扩展：Background service worker已启动');

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CLASSIFY_PAGE') {
        console.log('收到分类请求:', request.data);

        // 异步处理分类请求
        handleClassifyRequest(request.data, sender.tab)
            .then(result => {
                sendResponse({ success: true, result });
            })
            .catch(error => {
                console.error('分类失败:', error);
                sendResponse({ success: false, error: error.message });
            });

        // 返回true表示异步响应
        return true;
    }

    // 同步标签组颜色请求
    if (request.type === 'SYNC_TAB_GROUP_COLORS') {
        console.log('🔄 收到同步标签组颜色请求');
        updateAllTabGroupColors()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('同步颜色失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

// 处理分类请求
async function handleClassifyRequest(pageData, tab, options = { autoMove: true }) {
    // 0. 检查缓存 (URL完全匹配)
    const cachedResult = await checkCache(pageData.url);
    if (cachedResult) {
        console.log('✅ 命中URL缓存:', cachedResult);

        // 更新时间戳并重新保存，以便前端能检测到变化
        await saveClassification(pageData, {
            ...cachedResult,
            reason: cachedResult.reason.includes('(已缓存)') ? cachedResult.reason : `${cachedResult.reason} (已缓存)`
        });

        // 如果有tab，确保它在正确的组里
        if (options.autoMove && tab && tab.id) {
            await addToTabGroup(tab.id, cachedResult.category);
        }
        return { ...cachedResult, fromCache: true };
    }

    // 0.5 检查域名规则 (同域名自动归类)
    const domainResult = await checkDomainRule(pageData.url);
    if (domainResult) {
        console.log('✅ 命中域名规则:', domainResult);
        // 保存一条新的分类记录 (虽然是基于规则，但也算一次分类)
        const classification = {
            category: domainResult.category,
            reason: `基于域名规则自动分类 (${domainResult.domain})`,
            confidence: 'high'
        };
        await saveClassification(pageData, classification);

        if (options.autoMove && tab && tab.id) {
            await addToTabGroup(tab.id, classification.category);
        }
        return { ...classification, fromDomainRule: true };
    }

    // 1. 获取AI提供商和API密钥
    const config = await getConfig();
    if (!config.apiKey) {
        throw new Error(`请先在扩展设置中配置${config.provider === 'openai' ? 'OpenAI' : 'Gemini'} API密钥`);
    }

    // 2. 根据提供商调用相应的API
    let classification;
    if (config.provider === 'openai') {
        classification = await classifyWithOpenAI(pageData, config.apiKey, config.enabledTags);
    } else {
        classification = await classifyWithGemini(pageData, config.apiKey, config.enabledTags);
    }

    // 3. 保存分类结果 (同时更新域名规则)
    await saveClassification(pageData, classification);

    // 4. 将标签页添加到对应的标签组
    if (options.autoMove && tab && tab.id) {
        await addToTabGroup(tab.id, classification.category);
    }

    return classification;
}

// 从存储中获取配置
async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['ai_provider', 'openai_api_key', 'gemini_api_key', 'enabled_tags'], (result) => {
            const provider = result.ai_provider || 'openai';
            const apiKey = provider === 'openai' ? result.openai_api_key : result.gemini_api_key;
            // 默认标签列表
            const defaultTags = [
                '新闻资讯', '技术文档', '娱乐休闲', '电商购物',
                '社交媒体', '教育学习', '生活服务', '其他'
            ];
            const enabledTags = result.enabled_tags && result.enabled_tags.length > 0 ? result.enabled_tags : defaultTags;

            resolve({ provider, apiKey: apiKey || '', enabledTags });
        });
    });
}

// 调用OpenAI API进行分类
async function classifyWithOpenAI(pageData, apiKey, enabledTags) {
    const tagsList = enabledTags.map(tag => `- ${tag}`).join('\n');

    const prompt = `请分析以下网页内容，并将其分类到最合适的类别中。

网页标题：${pageData.title}
网页内容：${pageData.text}

请从以下类别中选择一个最合适的：
${tagsList}

请以JSON格式返回结果，格式如下：

请以JSON格式返回结果，格式如下：
{
  "category": "类别名称",
  "reason": "分类理由（1-2句话）",
  "confidence": "high/medium/low"
}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的网页内容分类助手。请准确分析网页内容并给出合适的分类。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API请求失败: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        return parseAIResponse(content);

    } catch (error) {
        console.error('OpenAI API调用失败:', error);
        throw error;
    }
}

// 调用Gemini API进行分类 - 优化版
async function classifyWithGemini(pageData, apiKey, enabledTags) {
    const tagsString = enabledTags.join(', ');

    // 简洁的英文prompt，避免Gemini返回markdown
    const prompt = `Classify this webpage. Return ONLY pure JSON, no markdown, no code blocks, no explanations.

Title: ${pageData.title}
Content: ${pageData.text.slice(0, 2000)}

Categories: ${tagsString}

Required JSON format (output this directly):
{"category":"类别","reason":"简短理由","confidence":"high"}`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 500,  // 增加到500避免截断
                    candidateCount: 1
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API请求失败: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Gemini API响应:', JSON.stringify(data, null, 2));

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('❌ Gemini API返回格式异常:', data);
            throw new Error('Gemini API返回格式异常');
        }

        let content = data.candidates[0].content.parts[0].text;
        console.log('📝 Gemini返回文本:', content);

        // 清理可能的markdown代码块
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        console.log('🧹 清理后文本:', content);

        return parseAIResponse(content);

    } catch (error) {
        console.error('❌ Gemini API调用失败:', error);
        throw error;
    }
}

// 解析AI响应 - 超级增强版，支持各种异常情况
function parseAIResponse(content) {
    console.log('🔍 [解析] 开始, 长度:', content.length);
    console.log('📄 [解析] 原始内容:', JSON.stringify(content));

    let result;

    try {
        // 清理内容
        let cleaned = content.trim();

        // 移除可能的markdown code block
        cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        cleaned = cleaned.trim();

        console.log('[解析] 清理后:', JSON.stringify(cleaned));

        // 策略1：直接解析
        try {
            result = JSON.parse(cleaned);
            console.log('✅ [解析] 直接解析成功:', result);
            return result;
        } catch (e) {
            console.log('⚠️ [解析] 直接解析失败:', e.message);
        }

        // 策略2：提取JSON对象
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            console.log('📦 [解析] 找到JSON:', jsonStr);

            try {
                result = JSON.parse(jsonStr);
                console.log('✅ [解析] 提取解析成功:', result);
                return result;
            } catch (e) {
                console.log('⚠️ [解析] 提取后解析失败:', e.message);

                // 策略3：智能补全JSON
                if (jsonStr.includes('"category"')) {
                    const catMatch = jsonStr.match(/"category"\s*:\s*"([^"]+)"/);
                    if (catMatch) {
                        result = {
                            category: catMatch[1],
                            reason: 'AI返回不完整，已自动补全',
                            confidence: 'medium'
                        };
                        console.log('✅ [解析] 智能补全成功:', result);
                        return result;
                    }
                }
            }
        }

        throw new Error('找不到有效JSON');

    } catch (finalError) {
        console.error('❌ [解析] 所有策略失败:', finalError.message);
        console.error('原始:', content);

        result = {
            category: '其他',
            reason: `解析失败: ${content.slice(0, 50)}`,
            confidence: 'low'
        };
        console.warn('⚠️ [解析] 使用默认:', result);
    }

    return result;
}


// 将标签页添加到对应的标签组 - 增强版
async function addToTabGroup(tabId, category) {
    try {
        // 检查标签页是否存在且在普通窗口中
        const tab = await chrome.tabs.get(tabId);
        const window = await chrome.windows.get(tab.windowId);

        if (window.type !== 'normal') {
            console.warn('⚠️ 标签页不在普通窗口中，跳过标签组操作');
            return;
        }

        // 查找或创建标签组
        let groupId = await getOrCreateTabGroup(category, tab.windowId);

        // 如果返回-1，说明需要创建新组
        if (groupId === -1) {
            console.log(`🔨 创建新组并添加标签`);

            // 先创建组（将当前标签加入组即可创建组）
            groupId = await chrome.tabs.group({ tabIds: [tabId] });

            // 获取动态颜色设置
            const chromeColor = await getTagChromeColor(category);

            await chrome.tabGroups.update(groupId, {
                title: category,
                color: chromeColor,
                collapsed: false
            });

            console.log(`✅ 创建新标签组并添加标签: "${category}"`);
        } else {
            // 组已存在，直接添加标签
            await chrome.tabs.group({ tabIds: [tabId], groupId });
            console.log(`✅ 标签页已添加到已存在的"${category}"组`);
        }

    } catch (error) {
        console.error('❌ 添加到标签组失败:', error);
        console.error('错误详情:', error.message);
        // 不抛出错误，保证分类功能正常
    }
}



// 获取或创建标签组 - 修复版
async function getOrCreateTabGroup(category, windowId) {
    // 获取当前窗口的所有标签组
    const groups = await chrome.tabGroups.query({ windowId: windowId });

    // 查找同名标签组
    const existingGroup = groups.find(g => g.title === category);
    if (existingGroup) {
        console.log(`♻️ 使用已存在的标签组: ${category} (ID: ${existingGroup.id})`);
        return existingGroup.id;
    }

    // 创建新的标签组
    console.log(`🆕 准备创建新标签组: ${category}`);

    // 直接返回-1，让addToTabGroup函数处理组的创建
    return -1;  // 特殊值，表示需要创建新组
}


// 保存分类结果到本地存储
async function saveClassification(pageData, classification) {
    // 保存域名规则
    await saveDomainRule(pageData.url, classification.category);

    return new Promise((resolve) => {
        // 创建分类记录
        const record = {
            id: Date.now(),
            url: pageData.url,
            title: pageData.title,
            category: classification.category,
            reason: classification.reason,
            confidence: classification.confidence || 'unknown',
            timestamp: new Date().toISOString()
        };

        // 获取现有记录
        chrome.storage.local.get(['classifications'], (result) => {
            const classifications = result.classifications || [];

            // 添加新记录到开头
            classifications.unshift(record);

            // 只保留最近100条记录
            if (classifications.length > 100) {
                classifications.splice(100);
            }

            // 保存
            chrome.storage.local.set({ classifications }, () => {
                console.log('💾 分类结果已保存:', record);
                resolve();
            });
        });
    });
}

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('🎉 扩展已安装，欢迎使用！');

        // 初始化默认配置
        chrome.storage.local.set({
            classifications: [],
            ai_provider: 'openai',  // 默认使用OpenAI
            settings: {
                autoClassify: false,  // 默认不自动分类
                showNotification: true,
                autoGroup: true  // 默认自动添加到标签组
            }
        });
    }
});

// 获取标签对应的 Chrome 颜色 (固定映射)
function getTagChromeColor(category) {
    const colorMap = {
        '学习工作': 'blue',
        '影视娱乐': 'purple',
        'AI工具': 'cyan',
        '购物消费': 'red',
        '社交媒体': 'pink',
        '新闻阅读': 'grey',
        '技术开发': 'green',
        '金融理财': 'orange',
        '生活日常': 'yellow',
        '其他分类': 'grey',
        // 旧版标签兼容
        '新闻资讯': 'red',
        '技术文档': 'blue',
        '娱乐休闲': 'purple',
        '电商购物': 'orange',
        '教育学习': 'green',
        '生活服务': 'yellow',
        '其他': 'grey'
    };
    return colorMap[category] || 'grey';
}

// 更新所有现有标签组的颜色
async function updateAllTabGroupColors() {
    try {
        // 获取所有窗口
        const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });

        for (const window of windows) {
            // 获取该窗口的所有标签组
            const groups = await chrome.tabGroups.query({ windowId: window.id });

            for (const group of groups) {
                if (group.title) {
                    const newColor = await getTagChromeColor(group.title);
                    try {
                        await chrome.tabGroups.update(group.id, { color: newColor });
                        console.log(`🎨 更新标签组 "${group.title}" 颜色为 ${newColor}`);
                    } catch (e) {
                        console.warn(`⚠️ 无法更新标签组 "${group.title}":`, e.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ 更新标签组颜色失败:', error);
    }
}

// --- 缓存与规则辅助函数 ---

// 检查URL缓存
async function checkCache(url) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['classifications'], (result) => {
            const classifications = result.classifications || [];
            // 查找最近的匹配记录 (只看最近100条)
            const match = classifications.find(c => c.url === url);
            resolve(match || null);
        });
    });
}

// 检查域名规则 (兼容新旧格式)
async function checkDomainRule(url) {
    const domain = getDomain(url);
    if (!domain) return null;

    return new Promise((resolve) => {
        chrome.storage.local.get(['domain_rules'], (result) => {
            const rules = result.domain_rules || {};
            const data = rules[domain];
            if (data) {
                // 兼容旧格式（字符串）和新格式（对象）
                const category = typeof data === 'string' ? data : data.category;
                resolve({ domain, category });
            } else {
                resolve(null);
            }
        });
    });
}

// 保存域名规则 (含时间戳)
async function saveDomainRule(url, category) {
    const domain = getDomain(url);
    if (!domain) return;

    return new Promise((resolve) => {
        chrome.storage.local.get(['domain_rules'], (result) => {
            const rules = result.domain_rules || {};
            // 更新规则 (覆盖旧的)，新格式包含时间戳
            rules[domain] = {
                category: category,
                timestamp: new Date().toISOString()
            };
            chrome.storage.local.set({ domain_rules: rules }, () => {
                console.log(`📏 更新域名规则: ${domain} -> ${category}`);
                resolve();
            });
        });
    });
}

// 提取域名
function getDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname;
    } catch (e) {
        return null;
    }
}

// --- 自动分类逻辑 ---

let tabTimers = {};

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        startAutoClassifyTimer(tabId, tab.url);
    }
});

// 监听标签页移除
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabTimers[tabId]) {
        clearTimeout(tabTimers[tabId]);
        delete tabTimers[tabId];
    }
});

// 启动自动分类计时器
function startAutoClassifyTimer(tabId, url) {
    if (tabTimers[tabId] && tabTimers[tabId] !== 'pending') {
        clearTimeout(tabTimers[tabId]);
    }

    // 标记为正在准备计时
    tabTimers[tabId] = 'pending';

    // 获取设置的延迟 (默认60s)
    chrome.storage.local.get(['settings'], (result) => {
        // 如果在获取设置期间标签页被关闭 (tabTimers[tabId]被删除)，则不启动计时器
        if (!tabTimers[tabId]) return;

        const settings = result.settings || {};
        const delay = settings.autoDelay || 60000;

        console.log(`⏱️ [Auto] 计时器启动: Tab ${tabId}, 延迟 ${delay}ms, URL: ${url}`);

        // 启动计时器
        tabTimers[tabId] = setTimeout(async () => {
            try {
                console.log(`⏰ [Auto] 计时器触发: Tab ${tabId}`);

                // 检查配置
                const currentSettings = (await chrome.storage.local.get(['settings'])).settings;
                if (!currentSettings || !currentSettings.autoClassify) {
                    console.log('🚫 [Auto] 自动分类已关闭，跳过');
                    return;
                }

                // 再次检查标签页状态
                let currentTab;
                try {
                    currentTab = await chrome.tabs.get(tabId);
                } catch (e) {
                    console.log('🚫 [Auto] 标签页已不存在');
                    return;
                }

                if (currentTab && currentTab.url === url) {
                    console.log(`🔍 [Auto] 开始分析页面: ${url}`);

                    // 先检查是否已有域名规则（用户已手动分类）
                    const existingRule = await checkDomainRule(url);
                    if (existingRule) {
                        console.log('✅ [Auto] 该域名已有分类规则，跳过自动分类:', existingRule);
                        // 发送"已分类"提示
                        chrome.tabs.sendMessage(tabId, {
                            type: 'SHOW_ALREADY_CLASSIFIED',
                            classification: {
                                category: existingRule.category,
                                reason: '该网站已有分类记录，无需重复识别'
                            }
                        }, () => {
                            if (chrome.runtime.lastError) {
                                console.warn('⚠️ [Auto] 发送提示失败');
                            }
                        });
                        return;
                    }

                    // 提取页面内容
                    const injectionResults = await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        func: () => {
                            return {
                                title: document.title,
                                text: document.body.innerText.slice(0, 5000),
                                url: window.location.href
                            };
                        }
                    });

                    if (injectionResults && injectionResults[0]) {
                        const pageData = injectionResults[0].result;

                        // ★ 核心检查：该标签页是否已经在某个标签组中？
                        if (currentTab.groupId && currentTab.groupId !== -1) {
                            try {
                                const group = await chrome.tabGroups.get(currentTab.groupId);
                                console.log('✅ [Auto] 该标签页已在标签组中:', group.title);
                                // 直接显示"已归类"绿色提示
                                chrome.tabs.sendMessage(tabId, {
                                    type: 'SHOW_ALREADY_CLASSIFIED',
                                    classification: {
                                        category: group.title || '未命名组'
                                    }
                                }, () => {
                                    if (chrome.runtime.lastError) {
                                        console.warn('⚠️ [Auto] 发送提示失败');
                                    }
                                });
                                return; // 结束，不再调用AI
                            } catch (e) {
                                console.warn('⚠️ [Auto] 获取标签组信息失败:', e);
                            }
                        }

                        // 没有在标签组中，调用AI进行分类
                        console.log('🤖 [Auto] 调用AI分类...');
                        const classification = await handleClassifyRequest(pageData, currentTab, { autoMove: false });
                        console.log('✅ [Auto] 分类完成:', classification);

                        // 发送正常的分类建议提示
                        chrome.tabs.sendMessage(tabId, {
                            type: 'SHOW_AUTO_PROMPT',
                            classification: classification
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.warn('⚠️ [Auto] 发送提示失败');
                            } else {
                                console.log('📨 [Auto] 提示已发送');
                            }
                        });
                    }
                } else {
                    console.log('🚫 [Auto] URL已变更，跳过');
                }
            } catch (e) {
                console.error('❌ [Auto] 自动分类出错:', e);
            }
        }, delay);
    });
}

// 监听确认消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CONFIRM_AUTO_CLASSIFY') {
        const { category } = request;
        if (sender.tab) {
            addToTabGroup(sender.tab.id, category);
        }
    }
});
