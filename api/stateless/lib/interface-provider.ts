import Config from '../../common/config.js';
import { Static } from '@sinclair/typebox';
import { FullConfig } from '../../common/types.js';

export type ProviderSettingKey = keyof Static<typeof FullConfig>;

export type ProviderLoader<T> = {
    name: string;
    load: (config: Config) => Promise<T | null>;
};

const RETRY_MS = 30 * 1000;

/**
 * @class
 * A Manager of providers that follows the settings they are configured by,
 * API replicas would otherwise each report the settings as of their own boot
 */
export abstract class ProviderManager<T extends { _id: string }> extends Map<string, T> {
    defaultProvider: string | null;

    _config: Config;

    #fingerprint?: string;
    #retryAt?: number;
    #refreshing?: Promise<void>;

    abstract label: string;
    abstract settingKeys: ProviderSettingKey[];
    abstract providers: ProviderLoader<T>[];

    constructor(config: Config) {
        super();
        this._config = config;
        this.defaultProvider = null;
    }

    async refresh(): Promise<void> {
        if (!this.#refreshing) {
            this.#refreshing = this.#refresh().finally(() => {
                this.#refreshing = undefined;
            });
        }

        return this.#refreshing;
    }

    async #refresh(): Promise<void> {
        const fingerprint = JSON.stringify(await this._config.models.Setting.typedKeys(this.settingKeys));

        const retry = this.#retryAt !== undefined && Date.now() >= this.#retryAt;
        if (fingerprint === this.#fingerprint && !retry) return;

        const loaded: T[] = [];
        let failed = false;

        for (const provider of this.providers) {
            try {
                const instance = await provider.load(this._config);
                if (instance) loaded.push(instance);
            } catch (err) {
                failed = true;
                console.error(`not ok - ${provider.name} ${this.label} Provider failed to initialize`, err);
            }
        }

        this.clear();
        for (const instance of loaded) this.set(instance._id, instance);

        this.defaultProvider = loaded.length ? loaded[0]._id : null;
        this.#fingerprint = fingerprint;
        this.#retryAt = failed ? Date.now() + RETRY_MS : undefined;
    }
}
