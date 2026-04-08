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

    // Получаем или создаём сессию пользователя (упрощённо — по email)
    let userId = req.headers['x-user-id'];
    if (!userId) {
        // Временный пользователь — в реальном проекте используйте аутентификацию
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id')
            .limit(1)
            .single();
        
        if (error || !profile) {
            // Создаём демо-пользователя
            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({ id: '00000000-0000-0000-0000-000000000001', email: 'demo@example.com' })
                .select()
                .single();
            userId = '00000000-0000-0000-0000-000000000001';
        } else {
            userId = profile.id;
        }
    }

    // === CRUD операции с командами ===
    if (req.method === 'GET' && req.query.action === 'teams') {
        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, teams: data });
    }

    if (req.method === 'POST' && req.body.action === 'save_team') {
        const { team } = req.body;
        const { data, error } = await supabase
            .from('teams')
            .upsert({
                id: team.id === 'new' ? undefined : team.id,
                user_id: userId,
                name: team.name,
                description: team.description,
                members: team.members,
                product_owner: team.productOwner,
                metrics: team.metrics || {}
            })
            .select();
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, team: data[0] });
    }

    if (req.method === 'DELETE' && req.query.action === 'team') {
        const { id } = req.query;
        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // === Сохранение файлов ===
    if (req.method === 'POST' && req.body.action === 'save_file') {
        const { teamId, fileName, fileType, fileData } = req.body;
        const { data, error } = await supabase
            .from('team_files')
            .insert({
                team_id: teamId,
                file_name: fileName,
                file_type: fileType,
                file_data: fileData.substring(0, 5000) // ограничение для demo
            })
            .select();
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, file: data[0] });
    }

    if (req.method === 'GET' && req.query.action === 'files') {
        const { teamId } = req.query;
        const { data, error } = await supabase
            .from('team_files')
            .select('*')
            .eq('team_id', teamId);
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, files: data });
    }

    if (req.method === 'DELETE' && req.query.action === 'file') {
        const { id } = req.query;
        const { error } = await supabase
            .from('team_files')
            .delete()
            .eq('id', id);
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // === AI анализ (как было) ===
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
            return res.status(500).json({ error: data.error?.message || 'Ошибка Groq API' });
        }

        const analysis = data.choices?.[0]?.message?.content || 'Не удалось получить ответ';
        res.json({ success: true, analysis });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: error.message });
    }
}
