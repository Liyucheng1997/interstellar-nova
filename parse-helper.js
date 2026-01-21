// 解析AI响应（通用）- 增强版
function parseAIResponse(content) {
    console.log('🔍 开始解析AI响应, 长度:', content.length);
    console.log('📄 原始内容:', content);

    let result;
    try {
        // 策略1：直接解析
        try {
            result = JSON.parse(content.trim());
            console.log('✅ 直接解析成功:', result);
            return result;
        } catch (directError) {
            console.log('⚠️ 直接解析失败:', directError.message);
        }

        // 策略2：提取JSON并补全
        let jsonStr = content;

        // 清理可能的markdown code block
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        jsonStr = jsonStr.trim();

        // 尝试找到JSON对象
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
            console.log('📦 提取JSON:', jsonStr);
        }

        // 尝试修复不完整的JSON
        if (jsonStr.startsWith('{') && !jsonStr.endsWith('}')) {
            console.log('🔧 JSON不完整，尝试补全...');

            // 智能补全
            if (jsonStr.includes('"category":')) {
                // 至少有category字段
                const categoryMatch = jsonStr.match(/"category"\s*:\s*"([^"]+)"/);
                if (categoryMatch) {
                    const category = categoryMatch[1];
                    console.log('✅ 找到category:', category);

                    // 构造完整JSON
                    jsonStr = JSON.stringify({
                        category: category,
                        reason: 'AI响应不完整，自动补全',
                        confidence: 'low'
                    });
                    console.log('🔧 补全后:', jsonStr);
                }
            } else {
                throw new Error('无法找到有效的category字段');
            }
        }

        // 解析
        result = JSON.parse(jsonStr);
        console.log('✅ 解析成功:', result);
        return result;

    } catch (parseError) {
        console.error('❌ 所有解析策略均失败:', parseError);
        console.error('原始内容:', content);

        // 最终降级方案
        result = {
            category: '其他',
            reason: `解析失败: ${content.slice(0, 100)}`,
            confidence: 'low'
        };
        console.warn('⚠️ 使用默认值:', result);
    }

    return result;
}

// 导出供测试
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseAIResponse };
}
