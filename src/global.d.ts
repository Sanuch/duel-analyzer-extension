declare module "webextension-polyfill" {
  import browser from "@types/webextension-polyfill";
  export default browser;
}

interface ImportMetaEnv {
  readonly VITE_PHRASES_MANIFEST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
