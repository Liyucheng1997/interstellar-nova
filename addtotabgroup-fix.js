// 将标签页添加到对应的标签组
async function addToTabGroup(tabId, category) {
    try {
        // 检查标签页是否存在且在普通窗口中
        const tab = await chrome.tabs.get(tabId);
        const window = await chrome.windows.get(tab.windowId);

        if (window.type !== 'normal') {
            console.warn('⚠️ 标签页不在普通窗口中，跳过标签组操作');
            return;
        }

        // 获取或创建对应类别的标签组
        const groupId = await getOrCreateTabGroup(category, tab.windowId);

        // 将标签页添加到标签组
        await chrome.tabs.group({ tabIds: [tabId], groupId });

        console.log(`✅ 标签页已添加到"${category}"组`);
    } catch (error) {
        console.error('❌ 添加到标签组失败:', error);
        console.error('错误详情:', error.message);
        // 不抛出错误，保证分类功能正常
    }
}
