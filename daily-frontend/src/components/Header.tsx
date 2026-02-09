'use client';

import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect, WalletDropdownLink, WalletDropdownBasename, WalletDropdownFundLink } from '@coinbase/onchainkit/wallet';
import { Avatar, Name, Address, EthBalance, Identity } from '@coinbase/onchainkit/identity';

export function Header() {
    return (
        <header className="px-6 py-4 flex justify-between items-center border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <span className="text-xl font-bold">💿</span>
                </div>
                <h1 className="font-bold text-lg hidden sm:block">Disco Daily</h1>
            </div>

            <div className="flex items-center gap-3">
                <Wallet>
                    <ConnectWallet className="bg-indigo-600 hover:bg-indigo-500 text-white !rounded-2xl border-none h-11 px-4 font-bold shadow-lg shadow-indigo-500/20 transition-all font-sans">
                        <Avatar className="h-6 w-6" />
                        <Name className="text-white" />
                    </ConnectWallet>
                    <WalletDropdown className="bg-slate-800 border-slate-700 rounded-2xl shadow-2xl p-2 !font-sans">
                        <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                            <Avatar />
                            <Name />
                            <Address />
                            <EthBalance />
                        </Identity>
                        <WalletDropdownBasename />
                        <WalletDropdownFundLink />
                        <WalletDropdownDisconnect className="hover:bg-red-500/10 hover:text-red-500 text-slate-400 rounded-xl transition-colors" />
                    </WalletDropdown>
                </Wallet>
            </div>
        </header>
    );
}
