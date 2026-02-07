/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_ADMIN_ADDRESS: string
    readonly VITE_ADMIN_WALLETS: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

