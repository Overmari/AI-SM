// api/claude.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не разрешён' });

    const { prompt, questionType, metrics, context } = req.body;
    
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API ключ OpenRouter не настроен. Добавьте переменную OPENROUTER_API_KEY в Vercel.' });
    }

    let userPrompt = prompt;
    if (metrics && (questionType === 'analyze' || questionType === 'bottleneck' || questionType === 'retro' || questionType === 'predict')) {
        const metricsText = `
📊 Flow Distribution: ${JSON.stringify(metrics.flowDistribution || {})}
⚡ Flow Velocity (средняя): ${metrics.avgFlowVelocitySP || 0} SP
⏱️ Flow Time: ${metrics.flowTime || 0} дней
📦 Flow Load: ${metrics.flowLoadTotal || 0}
🎯 Flow Predictability: ${metrics.flowPredictability || 0}%
`;
        if (questionType === 'analyze') userPrompt = `Проанализируй метрики команды и дай рекомендации:\n${metricsText}`;
        else if (questionType === 'bottleneck') userPrompt = `Найди узкие горлышки на основе метрик:\n${metricsText}`;
        else if (questionType === 'retro') userPrompt = `Предложи сценарий ретроспективы на основе метрик:\n${metricsText}`;
        else if (questionType === 'predict') userPrompt = `Сделай прогноз скорости на следующий спринт:\n${metricsText}`;
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://ваш-сайт.vercel.app',
                'X-Title': 'Scrum Master AI'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-exp:free',
                messages: [{ role: 'user', content: userPrompt }],
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        const data = await response.json();
        if (data.error) return res.status(500).json({ error: data.error.message });
        res.json({ success: true, analysis: data.choices?.[0]?.message?.content || 'Не удалось получить ответ' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
