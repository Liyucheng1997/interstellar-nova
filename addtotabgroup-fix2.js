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
