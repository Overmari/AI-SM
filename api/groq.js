// api/groq.js
export default async function handler(req, res) {
    // Разрешаем CORS для вашего фронтенда
    res.setHeader('Access-Control-Allow-Origin', 'https://ai-sm-delta.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не разрешён. Используйте POST.' });

    const { prompt, questionType, metrics, teamName } = req.body;
    
    // Проверяем API ключ
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error('GROQ_API_KEY not set');
        return res.status(500).json({ error: 'API ключ Groq не настроен. Добавьте переменную GROQ_API_KEY в Vercel.' });
    }

    // Формируем запрос в зависимости от типа
    let userPrompt = prompt;
    
    if (metrics && questionType === 'analyze') {
        userPrompt = `Ты — Agile-коуч. Проанализируй метрики команды ${teamName || ''}:
        
📊 Flow Distribution: ${JSON.stringify(metrics.flowDistribution || {})}
⚡ Средняя скорость: ${metrics.avgFlowVelocitySP || 0} SP (${metrics.avgFlowVelocityTasks || 0} задач)
⚡ Скорость за последний спринт: ${metrics.lastSprintVelocitySP || 0} SP
⏱️ Flow Time: ${metrics.flowTime || 0} дней
📦 WIP (незавершённые задачи): ${metrics.flowLoadTotal || 0}
🎯 Предсказуемость: ${metrics.flowPredictability || 0}%

Напиши на русском языке:
1. Какие метрики в норме, а какие требуют внимания?
2. 3-5 конкретных рекомендаций для улучшения процессов
3. Какие практики Scrum/Kanban помогут команде?`;
    } 
    else if (metrics && questionType === 'bottleneck') {
        userPrompt = `На основе метрик команды ${teamName || ''} найди узкие горлышки:
Скорость: ${metrics.avgFlowVelocitySP || 0} SP
Flow Time: ${metrics.flowTime || 0} дней
WIP: ${metrics.flowLoadTotal || 0}
Предсказуемость: ${metrics.flowPredictability || 0}%

Ответь на русском языке:
1. Где главное узкое место?
2. Как его устранить? (со ссылками на теорию ограничений)`;
    }
    else if (metrics && questionType === 'retro') {
        userPrompt = `На основе метрик команды ${teamName || ''} предложи сценарий ретроспективы:
Скорость: ${metrics.avgFlowVelocitySP || 0} SP
Предсказуемость: ${metrics.flowPredictability || 0}%

Предложи на русском языке:
1. Тему ретроспективы
2. 3-4 упражнения для команды
3. Тайминг (60-90 минут)`;
    }
    else if (metrics && questionType === 'predict') {
        userPrompt = `На основе исторических метрик команды ${teamName || ''} сделай прогноз:
Средняя скорость: ${metrics.avgFlowVelocitySP || 0} SP
Предсказуемость: ${metrics.flowPredictability || 0}%

Ответь на русском языке:
1. Какой ожидается скорость в следующем спринте?
2. Какие риски могут повлиять на прогноз?`;
    }
    else if (!prompt) {
        userPrompt = 'Привет! Расскажи кратко, как ты можешь помочь Scrum-мастеру.';
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: userPrompt }],
                max_tokens: 1500,
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Groq API error:', data);
            return res.status(500).json({ error: data.error?.message || 'Ошибка Groq API' });
        }

        const analysis = data.choices?.[0]?.message?.content || 'Не удалось получить ответ';
        res.json({ success: true, analysis });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
}
