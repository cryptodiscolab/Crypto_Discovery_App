import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    return res.status(200).json({ 
        message: "Pong!", 
        node_version: process.version,
        env_keys: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('SECRET') || k.includes('VITE'))
    });
}
