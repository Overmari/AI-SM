// api/auth.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET: получение сессии
    if (req.method === 'GET' && req.query.action === 'session') {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.json({ user: null });
        }
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.json({ user: null });
        }
        return res.json({ user: { id: user.id, email: user.email } });
    }

    // POST: регистрация или вход
    if (req.method === 'POST') {
        const { action, email, password } = req.body;
        
        if (action === 'signup') {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) return res.status(400).json({ error: error.message });
            return res.json({ user: data.user });
        }
        
        if (action === 'signin') {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) return res.status(400).json({ error: error.message });
            return res.json({ user: data.user, session: data.session });
        }
        
        if (action === 'signout') {
            const { error } = await supabase.auth.signOut();
            if (error) return res.status(400).json({ error: error.message });
            return res.json({ success: true });
        }
    }
    
    return res.status(404).json({ error: 'Not found' });
}
