import type { Obervable } from 'dexie';

export interface BaseInterface<T> {
    count(): Promise<number>;
    liveCount(): Obervable<number>;

    list(): Promise<T[]>;
    liveList(): Obervable<T[]>;
}
