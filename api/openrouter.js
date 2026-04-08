export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не разрешён' });

    const { prompt, questionType, metrics } = req.body;
    
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API ключ OpenRouter не настроен' });
    }

    let userPrompt = prompt;
    if (metrics && questionType === 'analyze') {
        userPrompt = `Проанализируй метрики команды и дай рекомендации:
Скорость: ${metrics.avgFlowVelocitySP || 0} SP
Время выполнения: ${metrics.flowTime || 0} дней
Предсказуемость: ${metrics.flowPredictability || 0}%
WIP: ${metrics.flowLoadTotal || 0}`;
    } else if (!prompt) {
        userPrompt = 'Привет! Ты Agile-коуч. Расскажи кратко о себе.';
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://scrum-master-ai-eight.vercel.app',
                'X-Title': 'Scrum Master AI'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-exp:free',
                messages: [{ role: 'user', content: userPrompt }],
                max_tokens: 500,
                temperature: 0.7
            })
        });
        const data = await response.json();
        if (data.error) return res.status(500).json({ error: data.error.message });
        res.json({ success: true, analysis: data.choices?.[0]?.message?.content || 'Ответ не получен' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
