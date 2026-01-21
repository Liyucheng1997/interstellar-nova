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
