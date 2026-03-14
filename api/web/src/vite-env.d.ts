/// <reference types="vite/client" />

declare module 'dropzone/dist/dropzone.mjs' {
    interface DropzoneOptions {
        autoProcessQueue?: boolean;
        addRemoveLinks?: boolean;
        url?: string;
        [key: string]: unknown;
    }

    class Dropzone {
        constructor(selector: string | Element, options?: DropzoneOptions);
        on(event: string, callback: (file: File) => void): this;
        destroy(): void;
    }

    export default Dropzone;
}

interface ImportMetaEnv {
  readonly HASH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'dropzone/dist/dropzone.mjs' {
    export interface DropzoneOptions {
        autoProcessQueue?: boolean;
        url?: string;
        maxFiles?: number;
        acceptedFiles?: string;
    }

    export default class Dropzone {
        constructor(element: string | HTMLElement, options?: DropzoneOptions);
        on(event: 'addedfile', callback: (file: File) => void): this;
        on(event: string, callback: (...args: unknown[]) => void): this;
        destroy(): void;
    }
}
