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
});

// 处理分类请求
async function handleClassifyRequest(pageData, tab) {
    // 1. 获取AI提供商和API密钥
    const config = await getConfig();
    if (!config.apiKey) {
        throw new Error(`请先在扩展设置中配置${config.provider === 'openai' ? 'OpenAI' : 'Gemini'} API密钥`);
    }

    // 2. 根据提供商调用相应的API
    let classification;
    if (config.provider === 'openai') {
        classification = await classifyWithOpenAI(pageData, config.apiKey);
    } else {
        classification = await classifyWithGemini(pageData, config.apiKey);
    }

    // 3. 保存分类结果
    await saveClassification(pageData, classification);

    // 4. 将标签页添加到对应的标签组
    if (tab && tab.id) {
        await addToTabGroup(tab.id, classification.category);
    }

    return classification;
}

// 从存储中获取配置
async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['ai_provider', 'openai_api_key', 'gemini_api_key'], (result) => {
            const provider = result.ai_provider || 'openai';
            const apiKey = provider === 'openai' ? result.openai_api_key : result.gemini_api_key;
            resolve({ provider, apiKey: apiKey || '' });
        });
    });
}

// 调用OpenAI API进行分类
async function classifyWithOpenAI(pageData, apiKey) {
    const prompt = `请分析以下网页内容，并将其分类到最合适的类别中。

网页标题：${pageData.title}
网页内容：${pageData.text}

请从以下类别中选择一个最合适的：
- 新闻资讯：时事新闻、财经新闻、社会新闻等
- 技术文档：编程教程、技术博客、API文档、开发指南等
- 娱乐休闲：视频、音乐、游戏、影评、综艺等
- 电商购物：商品页面、购物网站、价格比较等
- 社交媒体：微博、推特、论坛帖子、社区讨论等
- 教育学习：在线课程、学术论文、学习资料、知识分享等
- 生活服务：美食、旅游、健康、房产、招聘等
- 其他：无法归类到以上类别的内容

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
async function classifyWithGemini(pageData, apiKey) {
    // 简洁的英文prompt，避免Gemini返回markdown
    const prompt = `Classify this webpage. Return ONLY pure JSON, no markdown, no code blocks, no explanations.

Title: ${pageData.title}
Content: ${pageData.text.slice(0, 2000)}

Categories: 新闻资讯, 技术文档, 娱乐休闲, 电商购物, 社交媒体, 教育学习, 生活服务, 其他

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

            // 设置组的属性
            const colorMap = {
                '新闻资讯': 'red',
                '技术文档': 'blue',
                '娱乐休闲': 'purple',
                '电商购物': 'orange',
                '社交媒体': 'cyan',
                '教育学习': 'green',
                '生活服务': 'yellow',
                '其他': 'grey'
            };

            await chrome.tabGroups.update(groupId, {
                title: category,
                color: colorMap[category] || 'grey',
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
    // 注意：我们返回groupId后，调用者会将目标标签添加到此组
    // 所以这里只需要创建一个空组即可
    console.log(`🆕 准备创建新标签组: ${category}`);

    // 颜色映射
    const colorMap = {
        '新闻资讯': 'red',
        '技术文档': 'blue',
        '娱乐休闲': 'purple',
        '电商购物': 'orange',
        '社交媒体': 'cyan',
        '教育学习': 'green',
        '生活服务': 'yellow',
        '其他': 'grey'
    };

    // 直接返回-1，让addToTabGroup函数处理组的创建
    // 这样可以避免创建临时标签的问题
    return -1;  // 特殊值，表示需要创建新组
}


// 保存分类结果到本地存储
async function saveClassification(pageData, classification) {
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

