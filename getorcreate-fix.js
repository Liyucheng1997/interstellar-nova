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
