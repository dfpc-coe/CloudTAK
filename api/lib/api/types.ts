export type TAKList<T> = {
    version: string;
    type: string;
    data: Array<T>;
    nodeId: string;
}
