import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const debug = req.query?.debug === '1';
    res.status(200).json({
        message: "Pong!",
        time: new Date().toISOString(),
        node_version: process.version,
        ...(debug && {
            env_keys: Object.keys(process.env).filter(k =>
                k.includes('SUPABASE') || k.includes('SECRET') || k.includes('VITE')
            )
        })
    });
}
