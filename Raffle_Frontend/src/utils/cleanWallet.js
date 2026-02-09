export const cleanWallet = (wallet) => {
    return wallet?.trim?.().toLowerCase() ?? null;
};
