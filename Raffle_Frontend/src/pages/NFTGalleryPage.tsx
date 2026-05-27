import { useCallback, useEffect, useState } from 'react';
import { Image, ExternalLink, Filter, AlertTriangle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { supabase } from '../lib/supabaseClient';

interface NFTItem {
  token_id: string;
  contract_address: string;
  name?: string;
  image_url?: string;
  tier?: string;
  minted_at?: string;
  chain_id?: number;
}

const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '8453');
const DAILY_APP_ADDRESS = import.meta.env.VITE_DAILY_APP_ADDRESS || '';
const IPFS_GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs/').trim();
const BASESCAN_URL = CHAIN_ID === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org';

const EMPTY_NFT: NFTItem[] = [];

const resolveNftAssetUrl = (value?: string | null): string | undefined => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (raw.startsWith('ipfs://')) {
    const cid = raw.replace('ipfs://', '').replace(/^ipfs\//, '');
    const gateway = IPFS_GATEWAY.endsWith('/') ? IPFS_GATEWAY : `${IPFS_GATEWAY}/`;
    return `${gateway}${cid}`;
  }
  return raw;
};

function NFTCard({ nft }: { nft: NFTItem }) {
  const tierColors: Record<string, string> = {
    DIAMOND: 'from-blue-500/30 to-purple-500/30 border-blue-500/50',
    PLATINUM: 'from-slate-400/20 to-slate-500/20 border-slate-400/50',
    GOLD: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/50',
    SILVER: 'from-gray-400/20 to-gray-500/20 border-gray-400/50',
    BRONZE: 'from-amber-700/20 to-orange-700/20 border-amber-700/50',
    ROOKIE: 'from-slate-800/30 to-slate-900/30 border-slate-700/30',
  };

  const tierGradient = tierColors[nft.tier || 'ROOKIE'] || tierColors.ROOKIE;

  return (
    <div className={`relative rounded-2xl overflow-hidden border bg-gradient-to-br ${tierGradient} group hover:scale-[1.02] transition-transform duration-300`}>
      <div className="aspect-square relative bg-slate-900 flex items-center justify-center">
        {nft.image_url ? (
          <img
            src={nft.image_url}
            alt={nft.name || `NFT #${nft.token_id}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-slate-600">
            <Image size={48} />
            <span className="text-[11px] font-black uppercase tracking-widest">No Image</span>
          </div>
        )}
        {nft.tier && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/80">{nft.tier}</span>
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-white truncate">
          {nft.name || `NFT #${nft.token_id}`}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            ID: {nft.token_id?.substring(0, 8)}...
          </span>
          {nft.chain_id && (
            <a
              href={`${BASESCAN_URL}/token/${nft.contract_address}?a=${nft.token_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        {nft.minted_at && (
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">
            Minted: {new Date(nft.minted_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/5 bg-slate-900 animate-pulse">
      <div className="aspect-square bg-slate-800" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-slate-800 rounded w-3/4" />
        <div className="h-2 bg-slate-800 rounded w-1/2" />
        <div className="h-2 bg-slate-800 rounded w-1/3" />
      </div>
    </div>
  );
}

export function NFTGalleryPage() {
  const { address, isConnected } = useAccount();
  const [nfts, setNfts] = useState<NFTItem[]>(EMPTY_NFT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<string>('ALL');

  const TIERS = ['ALL', 'DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'ROOKIE'];

  const fetchNFTs = useCallback(async () => {
    if (!address || !DAILY_APP_ADDRESS) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch SBT mint logs from Supabase metadata cache; metadata image_url is Pinata/IPFS-backed.
      const { data, error: supaError } = await supabase
        .from('user_activity_logs')
        .select('*')
        .eq('wallet_address', address?.toLowerCase())
        .eq('category', 'SBT')
        .eq('activity_type', 'Mint')
        .order('created_at', { ascending: false });

      if (supaError) throw supaError;

      if (data && data.length > 0) {
        const mapped: NFTItem[] = data.map((d: Record<string, unknown>) => {
          const meta = (d.metadata || {}) as Record<string, string>;
          return {
            token_id: String(meta?.token_id || d.tx_hash || d.id || 'unknown'),
            contract_address: String(meta?.contract_address || DAILY_APP_ADDRESS),
            name: String(meta?.name || `SBT #${String(meta?.token_id || '?').substring(0, 6)}`),
            image_url: resolveNftAssetUrl(meta?.image_url || meta?.image || meta?.badge_url),
            tier: String(meta?.tier || 'ROOKIE'),
            minted_at: String(d.created_at || ''),
            chain_id: CHAIN_ID,
          };
        });
        setNfts(mapped);
      } else {
        setNfts(EMPTY_NFT);
      }
    } catch (err) {
      console.warn('[NFTGallery] Failed to fetch NFTs:', err);
      setError('Failed to load NFT collection');
      setNfts(EMPTY_NFT);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchNFTs();
  }, [fetchNFTs]);

  // Real-time subscription for new mints
  useEffect(() => {
    if (!address) return;
    const channel = supabase
      .channel('nft-gallery-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activity_logs',
          filter: `wallet_address=eq.${address?.toLowerCase()}`,
        },
        () => {
          fetchNFTs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [address, fetchNFTs]);

  const filteredNFTs = tierFilter === 'ALL' ? nfts : nfts.filter((n) => n.tier === tierFilter);

  if (!isConnected) {
    return (
      <div className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[#050505] pb-safe flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <Image size={64} className="mx-auto text-slate-700" />
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Connect wallet to view NFT collection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden pb-safe md:pb-8">
      <div className="max-w-screen-lg mx-auto">
        {/* Midnight Cyber Header */}
        <div className="card-title-row mb-6">
          <div>
            <h2 className="text-xl text-white" style={{ fontFamily: 'var(--typography-family-heading)' }}>SBT Collection Gallery</h2>
            <p className="label-native text-[9px] text-slate-500 mt-1">{nfts.length} SBTs Collected</p>
          </div>
          <select className="input-cyber" style={{ padding: '8px 12px', fontSize: '12px', width: '140px' }}>
            <option value="ALL">All Tiers</option>
            <option value="DIAMOND">Diamond</option>
            <option value="PLATINUM">Platinum</option>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="BRONZE">Bronze</option>
            <option value="ROOKIE">Rookie</option>
          </select>
        </div>

        <div className="px-4">

        {/* Tier Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {TIERS.map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                tierFilter === tier
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
            <AlertTriangle size={48} className="text-red-500/50" />
            <p className="text-[11px] font-black uppercase tracking-widest text-red-400">{error}</p>
            <button
              onClick={fetchNFTs}
              className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
            >
              Retry
            </button>
          </div>
        ) : filteredNFTs.length === 0 ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
            <Filter size={48} className="text-slate-700" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              {tierFilter === 'ALL' ? 'No NFTs collected yet' : `No ${tierFilter} tier NFTs`}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 text-center max-w-xs">
              Complete daily check-ins, earn XP, and upgrade your SBT tier to grow your collection
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredNFTs.map((nft) => (
              <NFTCard key={nft.token_id} nft={nft} />
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
