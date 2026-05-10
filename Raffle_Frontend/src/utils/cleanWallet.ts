export const cleanWallet = (wallet: string | null | undefined) => {
    return wallet?.trim?.().toLowerCase() ?? null;
};
