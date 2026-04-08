// api/claude.js
export default async function handler(req, res) {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не разрешён. Используйте POST.' });
    }

    const { prompt, questionType, metrics, context } = req.body;
    
    // Если нет промпта и нет метрик, возвращаем ошибку
    if (!prompt && !metrics) {
        return res.status(400).json({ error: 'Не указан запрос или метрики' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('ANTHROPIC_API_KEY not set');
        return res.status(500).json({ error: 'API ключ Anthropic не настроен. Добавьте переменную ANTHROPIC_API_KEY в Vercel.' });
    }

    // Формируем системный промпт для Claude
    let systemPrompt = `Ты — опытный Agile-коуч и Scrum-мастер с 10+ лет опыта. 
Ты помогаешь командам анализировать Flow Metrics (Flow Distribution, Flow Velocity, Flow Time, Flow Load, Flow Predictability).
Отвечай на русском языке, используй профессиональные термины (Scrum, Kanban, SAFe), давай конкретные, применимые на практике рекомендации.
Будь дружелюбным, но профессиональным.`;

    let userPrompt = prompt;

    // Если переданы метрики команды
    if (metrics && (questionType === 'analyze' || questionType === 'bottleneck' || questionType === 'retro' || questionType === 'predict')) {
        const metricsText = `
📊 Flow Distribution: ${JSON.stringify(metrics.flowDistribution || {})}
⚡ Flow Velocity (средняя): ${metrics.avgFlowVelocitySP || 0} SP, ${metrics.avgFlowVelocityTasks || 0} задач
⚡ Flow Velocity (последний спринт): ${metrics.lastSprintVelocitySP || 0} SP, ${metrics.lastSprintVelocityTasks || 0} задач
⏱️ Flow Time: ${metrics.flowTime || 0} дней
📦 Flow Load: ${JSON.stringify(metrics.flowLoad || {})}, всего: ${metrics.flowLoadTotal || 0}
🎯 Flow Predictability: ${metrics.flowPredictability || 0}%
`;

        if (questionType === 'analyze') {
            userPrompt = `Проанализируй метрики команды и дай развёрнутую оценку:
${metricsText}

Включи в ответ:
1. Что в метриках хорошо?
2. Какие есть проблемы или узкие горлышки?
3. 3-5 конкретных рекомендаций для улучшения
4. Какие метрики стоит отслеживать в первую очередь?`;
        } else if (questionType === 'bottleneck') {
            userPrompt = `На основе этих метрик найди узкие горлышки в процессе разработки:
${metricsText}

Ответь:
1. Какие метрики указывают на проблемы?
2. Где самое узкое место?
3. Как его устранить? (ссылайся на теорию ограничений Голдратта)`;
        } else if (questionType === 'retro') {
            userPrompt = `На основе этих метрик предложи сценарий ретроспективы:
${metricsText}

Включи:
1. Тему ретроспективы
2. 4-5 упражнений для команды
3. Тайминг (обычно 60-90 минут)
4. Ожидаемые результаты`;
        } else if (questionType === 'predict') {
            userPrompt = `На основе исторических метрик сделай прогноз:
${metricsText}

Ответь:
1. Какой ожидается скорость в следующем спринте?
2. Какие риски могут повлиять на прогноз?
3. Что можно сделать для улучшения прогнозируемости?`;
        }
    } else if (context && prompt) {
        userPrompt = `Контекст о команде: ${context}\n\nВопрос: ${prompt}`;
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2000,
                temperature: 0.7,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('Claude API error:', data.error);
            return res.status(500).json({ error: data.error.message || 'Ошибка Claude API' });
        }

        const analysis = data.content?.[0]?.text || 'Не удалось получить ответ';
        res.json({ success: true, analysis });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
}
