// api/groq.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Получаем пользователя из токена
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const userId = user.id;

    // GET: получение команд пользователя
    if (req.method === 'GET' && req.query.action === 'teams') {
        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .eq('user_id', userId);
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, teams: data || [] });
    }

    // GET: получение файлов команды
    if (req.method === 'GET' && req.query.action === 'files') {
        const { teamId } = req.query;
        const { data, error } = await supabase
            .from('team_files')
            .select('*')
            .eq('team_id', teamId);
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, files: data || [] });
    }

    // POST: сохранение команды
    if (req.method === 'POST' && req.body.action === 'save_team') {
        const { team } = req.body;
        
        let result;
        if (team.id && team.id !== 'new') {
            result = await supabase
                .from('teams')
                .update({
                    name: team.name,
                    description: team.description,
                    members: team.members,
                    product_owner: team.productOwner,
                    metrics: team.metrics,
                    updated_at: new Date().toISOString()
                })
                .eq('id', team.id)
                .eq('user_id', userId)
                .select();
        } else {
            result = await supabase
                .from('teams')
                .insert({
                    user_id: userId,
                    name: team.name,
                    description: team.description,
                    members: team.members,
                    product_owner: team.productOwner,
                    metrics: team.metrics
                })
                .select();
        }
        
        if (result.error) return res.status(500).json({ error: result.error.message });
        return res.json({ success: true, team: result.data[0] });
    }

    // POST: сохранение файла
    if (req.method === 'POST' && req.body.action === 'save_file') {
        const { teamId, fileName, fileType, fileData } = req.body;
        const { error } = await supabase
            .from('team_files')
            .insert({
                team_id: teamId,
                file_name: fileName,
                file_type: fileType,
                file_data: fileData
            });
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // DELETE: удаление команды
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

    // DELETE: удаление файла
    if (req.method === 'DELETE' && req.query.action === 'file') {
        const { id } = req.query;
        const { error } = await supabase
            .from('team_files')
            .delete()
            .eq('id', id);
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // POST: AI-анализ (без авторизации, но с токеном)
    if (req.method === 'POST' && !req.body.action) {
        const { prompt, questionType, metrics, teamName } = req.body;
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });
        
        let finalPrompt = prompt;
        if (metrics && questionType === 'analyze') {
            finalPrompt = `Проанализируй метрики ${teamName}: скорость ${metrics.avgFlowVelocitySP || 0} SP, время ${metrics.flowTime || 0} дн, предсказуемость ${metrics.flowPredictability || 0}%, WIP ${metrics.flowLoadTotal || 0}. Дай 3-5 рекомендаций.`;
        }
        
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: finalPrompt }], max_tokens: 1500, temperature: 0.7 })
            });
            const data = await response.json();
            if (!response.ok) return res.status(500).json({ error: data.error?.message });
            return res.json({ success: true, analysis: data.choices?.[0]?.message?.content });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    
    return res.status(404).json({ error: 'Unknown action' });
}
