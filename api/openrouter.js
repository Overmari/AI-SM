// api/openrouter.js
export default async function handler(req, res) {
    // Разрешаем CORS для вашего фронтенда
    res.setHeader('Access-Control-Allow-Origin', 'https://ai-sm-delta.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не разрешён. Используйте POST.' });

    const { prompt, questionType, metrics, teamName, context } = req.body;
    
    // Проверяем API ключ
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('OPENROUTER_API_KEY not set');
        return res.status(500).json({ error: 'API ключ OpenRouter не настроен. Добавьте переменную OPENROUTER_API_KEY в Vercel.' });
    }

    // Формируем системный промпт
    let systemPrompt = `Ты — опытный Agile-коуч и Scrum-мастер с 10+ лет опыта. 
Ты помогаешь командам анализировать Flow Metrics (Flow Distribution, Flow Velocity, Flow Time, Flow Load, Flow Predictability).
Отвечай на русском языке, используй профессиональные термины (Scrum, Kanban, SAFe), давай конкретные, применимые на практике рекомендации.
Будь дружелюбным, но профессиональным.`;

    let userPrompt = prompt;

    // Если переданы метрики команды для стандартных вопросов
    if (metrics && (questionType === 'analyze' || questionType === 'bottleneck' || questionType === 'retro' || questionType === 'predict')) {
        const teamInfo = teamName ? `Команда: ${teamName}\n` : '';
        const metricsText = `
${teamInfo}📊 Flow Distribution: ${JSON.stringify(metrics.flowDistribution || {})}
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
    } else if (prompt) {
        userPrompt = prompt;
    } else {
        userPrompt = 'Привет! Расскажи кратко о том, как ты можешь помочь Scrum-мастеру.';
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
                model: 'google/gemini-2.0-flash-exp:free',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('OpenRouter API error:', data.error);
            return res.status(500).json({ error: data.error.message || 'Ошибка OpenRouter API' });
        }

        const analysis = data.choices?.[0]?.message?.content || 'Не удалось получить ответ';
        res.json({ success: true, analysis });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
}
