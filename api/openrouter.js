// api/openrouter.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://ai-sm-delta.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не разрешён' });

    const { prompt, questionType, metrics, teamName } = req.body;
    
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API ключ OpenRouter не настроен' });
    }

    // ✅ Используем рабочую бесплатную модель
    const model = 'meta-llama/llama-3.3-70b-instruct:free';

    let userPrompt = prompt;
    
    if (metrics && questionType === 'analyze') {
        userPrompt = `Проанализируй метрики команды ${teamName || ''}:
Средняя скорость: ${metrics.avgFlowVelocitySP || 0} SP
Время выполнения: ${metrics.flowTime || 0} дней
Предсказуемость: ${metrics.flowPredictability || 0}%
WIP: ${metrics.flowLoadTotal || 0}

Дай 3-5 конкретных рекомендаций по улучшению.`;
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://ai-sm-delta.vercel.app',
                'X-Title': 'Scrum Master AI'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: userPrompt }],
                max_tokens: 1500,
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('OpenRouter API error:', data);
            return res.status(500).json({ error: data.error?.message || 'Ошибка API' });
        }

        const analysis = data.choices?.[0]?.message?.content || 'Не удалось получить ответ';
        res.json({ success: true, analysis });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: error.message });
    }
}
