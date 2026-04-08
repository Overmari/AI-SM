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
    const userId = '00000000-0000-0000-0000-000000000001';

    // Получение всех команд
    if (req.method === 'GET' && req.query.action === 'teams') {
        const { data, error } = await supabase.from('teams').select('*').eq('user_id', userId);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, teams: data });
    }

    // Сохранение команды
    if (req.method === 'POST' && req.body.action === 'save_team') {
        const { team } = req.body;
        let result;
        if (team.id && team.id !== 'new') {
            result = await supabase.from('teams').update({
                name: team.name, description: team.description, members: team.members,
                product_owner: team.productOwner, metrics: team.metrics, updated_at: new Date()
            }).eq('id', team.id).eq('user_id', userId).select();
        } else {
            result = await supabase.from('teams').insert({
                user_id: userId, name: team.name, description: team.description,
                members: team.members, product_owner: team.productOwner, metrics: team.metrics
            }).select();
        }
        if (result.error) return res.status(500).json({ error: result.error.message });
        return res.json({ success: true, team: result.data[0] });
    }

    // Удаление команды
    if (req.method === 'DELETE' && req.query.action === 'team') {
        const { id } = req.query;
        const { error } = await supabase.from('teams').delete().eq('id', id).eq('user_id', userId);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // Получение файлов команды
    if (req.method === 'GET' && req.query.action === 'files') {
        const { teamId } = req.query;
        const { data, error } = await supabase.from('team_files').select('*').eq('team_id', teamId);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, files: data });
    }

    // Сохранение файла
    if (req.method === 'POST' && req.body.action === 'save_file') {
        const { teamId, fileName, fileType, fileData } = req.body;
        const { error } = await supabase.from('team_files').insert({
            team_id: teamId, file_name: fileName, file_type: fileType, file_data: fileData
        });
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // Удаление файла
    if (req.method === 'DELETE' && req.query.action === 'file') {
        const { id } = req.query;
        const { error } = await supabase.from('team_files').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // === AI-анализ через Groq ===
    const { prompt, questionType, metrics, teamName } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY не настроен' });

    let finalPrompt = prompt;
    if (metrics && questionType === 'analyze') {
        finalPrompt = `Проанализируй метрики команды ${teamName}: скорость ${metrics.avgFlowVelocitySP || 0} SP, время ${metrics.flowTime || 0} дн, предсказуемость ${metrics.flowPredictability || 0}%, WIP ${metrics.flowLoadTotal || 0}. Дай 3-5 рекомендаций.`;
    } else if (questionType === 'analyze_files') {
        finalPrompt = prompt;
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: finalPrompt }],
                max_tokens: 1500,
                temperature: 0.7
            })
        });
        const data = await response.json();
        if (!response.ok) return res.status(500).json({ error: data.error?.message });
        return res.json({ success: true, analysis: data.choices?.[0]?.message?.content });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
