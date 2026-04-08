// api/groq.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://ai-sm-delta.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );

    // === Получение всех команд ===
    if (req.method === 'GET' && req.query.action === 'teams') {
        // Для демо-режима используем фиксированный ID
        const userId = '00000000-0000-0000-0000-000000000001';
        
        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, teams: data });
    }

    // === Сохранение команды ===
    if (req.method === 'POST' && req.body.action === 'save_team') {
        const { team } = req.body;
        const userId = '00000000-0000-0000-0000-000000000001';
        
        let result;
        if (team.id && team.id !== 'new') {
            // Обновление существующей команды
            result = await supabase
                .from('teams')
                .update({
                    name: team.name,
                    description: team.description,
                    members: team.members,
                    product_owner: team.productOwner,
                    metrics: team.metrics || {},
                    updated_at: new Date().toISOString()
                })
                .eq('id', team.id)
                .eq('user_id', userId)
                .select();
        } else {
            // Создание новой команды
            result = await supabase
                .from('teams')
                .insert({
                    user_id: userId,
                    name: team.name,
                    description: team.description,
                    members: team.members,
                    product_owner: team.productOwner,
                    metrics: team.metrics || {}
                })
                .select();
        }
        
        if (result.error) return res.status(500).json({ error: result.error.message });
        return res.json({ success: true, team: result.data[0] });
    }

    // === Удаление команды ===
    if (req.method === 'DELETE' && req.query.action === 'team') {
        const { id } = req.query;
        const userId = '00000000-0000-0000-0000-000000000001';
        
        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // === AI анализ (основная функция) ===
    const { prompt, questionType, metrics, teamName } = req.body;
    
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY не настроен' });
    }

    let finalPrompt = prompt;
    if (metrics && questionType === 'analyze') {
        finalPrompt = `Проанализируй метрики команды ${teamName}:
Средняя скорость: ${metrics.avgFlowVelocitySP || 0} SP
Время выполнения: ${metrics.flowTime || 0} дней
Предсказуемость: ${metrics.flowPredictability || 0}%
WIP: ${metrics.flowLoadTotal || 0}

Дай 3-5 конкретных рекомендаций.`;
    } else if (!prompt || prompt === '') {
        finalPrompt = 'Привет! Расскажи кратко, как ты можешь помочь Scrum-мастеру.';
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
                messages: [{ role: 'user', content: finalPrompt }],
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
        res.status(500).json({ error: error.message });
    }
}
