import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/farcaster-check?address=0x...
 *
 * Server-side proxy untuk Neynar API.
 * NEYNAR_API_KEY disimpan di server dan TIDAK pernah diekspos ke browser.
 */
export async function GET(req: NextRequest) {
    const address = req.nextUrl.searchParams.get('address');

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    try {
        const res = await fetch(
            `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${normalizedAddress}`,
            {
                headers: {
                    // ✅ SERVER-SIDE ONLY — tidak pernah terekspos ke browser
                    'api_key': process.env.NEYNAR_API_KEY || '',
                },
                // Cache di Next.js server layer selama 5 menit
                next: { revalidate: 300 },
            }
        );

        if (res.status === 404) {
            return NextResponse.json(null, { status: 404 });
        }

        if (!res.ok) {
            console.error('[farcaster-check] Neynar API error:', res.status);
            return NextResponse.json({ error: 'Upstream API failure' }, { status: 502 });
        }

        const data = await res.json();
        const userList = data[normalizedAddress] || [];
        const user = userList.length > 0 ? userList[0] : null;

        return NextResponse.json(user, { status: 200 });

    } catch (err) {
        console.error('[farcaster-check] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
