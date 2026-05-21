import type { Observable } from 'dexie';

export interface BaseInterface<T> {
    count(): Promise<number>;
    liveCount(): Observable<number>;

    list(): Promise<T[]>;
    liveList(): Observable<T[]>;
}
