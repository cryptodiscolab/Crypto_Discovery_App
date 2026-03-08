/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_ADMIN_ADDRESS: string

}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

