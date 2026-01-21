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
