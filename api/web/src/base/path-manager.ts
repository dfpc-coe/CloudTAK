import { v4 as randomUUID } from 'uuid';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PathNode<T = any> {
    id: string;
    name: string;
    fullPath: string;
    count: number;
    opened: boolean;
    loading: boolean;
    children: PathNode<T>[];
    items: Set<T>;
}

export default class PathManager {
    /**
     * Normalize a path: ensure leading slash, remove trailing slash, collapse duplicate slashes
     */
    static normalize(path: string): string {
        if (!path) return '/';
        if (!path.startsWith('/')) path = '/' + path;
        path = path.replace(/\/+/g, '/');
        if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
        return path;
    }

    /**
     * Get the display name (last segment) of a path
     */
    static displayName(path: string): string {
        const normalized = PathManager.normalize(path);
        if (normalized === '/') return '/';
        const segments = normalized.split('/').filter(Boolean);
        return segments[segments.length - 1];
    }

    /**
     * Get the parent path of a given path
     */
    static parentPath(path: string): string {
        const normalized = PathManager.normalize(path);
        if (normalized === '/') return '/';
        const lastSlash = normalized.lastIndexOf('/');
        if (lastSlash <= 0) return '/';
        return normalized.substring(0, lastSlash);
    }

    /**
     * Build a nested tree from a flat array of paths.
     * Intermediate nodes are created automatically for nested paths.
     */
    static buildTree<T = unknown>(flatPaths: Array<{ path: string; count: number }>): PathNode<T>[] {
        const nodeMap = new Map<string, PathNode<T>>();
        const roots: PathNode<T>[] = [];

        const sorted = [...flatPaths].sort((a, b) => a.path.localeCompare(b.path));

        for (const { path, count } of sorted) {
            const normalized = PathManager.normalize(path);
            if (normalized === '/') continue;

            const segments = normalized.split('/').filter(Boolean);
            let currentPath = '';

            for (let i = 0; i < segments.length; i++) {
                currentPath += '/' + segments[i];

                if (!nodeMap.has(currentPath)) {
                    const isTarget = i === segments.length - 1;
                    const node: PathNode<T> = {
                        id: randomUUID(),
                        name: segments[i],
                        fullPath: currentPath,
                        count: isTarget ? count : 0,
                        opened: false,
                        loading: false,
                        children: [],
                        items: new Set()
                    };

                    nodeMap.set(currentPath, node);

                    if (i === 0) {
                        roots.push(node);
                    } else {
                        const parentNodePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                        const parent = nodeMap.get(parentNodePath);
                        if (parent) {
                            parent.children.push(node);
                        }
                    }
                } else if (i === segments.length - 1) {
                    const existing = nodeMap.get(currentPath)!;
                    existing.count = count;
                }
            }
        }

        return roots;
    }

    /**
     * Find a node by its full path
     */
    static findNode<T = unknown>(nodes: PathNode<T>[], path: string): PathNode<T> | undefined {
        const normalized = PathManager.normalize(path);

        for (const node of nodes) {
            if (node.fullPath === normalized) return node;
            const found = PathManager.findNode(node.children, normalized);
            if (found) return found;
        }

        return undefined;
    }

    /**
     * Find a node by its id
     */
    static findNodeById<T = unknown>(nodes: PathNode<T>[], id: string): PathNode<T> | undefined {
        for (const node of nodes) {
            if (node.id === id) return node;
            const found = PathManager.findNodeById(node.children, id);
            if (found) return found;
        }

        return undefined;
    }

    /**
     * Add a path to the tree, creating intermediate nodes as needed.
     * Returns the leaf node.
     */
    static addPath<T = unknown>(nodes: PathNode<T>[], path: string): PathNode<T> {
        const normalized = PathManager.normalize(path);
        const segments = normalized.split('/').filter(Boolean);

        let currentNodes = nodes;
        let currentPath = '';
        let node: PathNode<T> | undefined;

        for (let i = 0; i < segments.length; i++) {
            currentPath += '/' + segments[i];
            node = currentNodes.find(n => n.fullPath === currentPath);

            if (!node) {
                node = {
                    id: randomUUID(),
                    name: segments[i],
                    fullPath: currentPath,
                    count: 0,
                    opened: false,
                    loading: false,
                    children: [],
                    items: new Set()
                };
                currentNodes.push(node);
                currentNodes.sort((a, b) => a.name.localeCompare(b.name));
            }

            currentNodes = node.children;
        }

        return node!;
    }

    /**
     * Remove a path from the tree. Returns the removed node.
     */
    static removePath<T = unknown>(nodes: PathNode<T>[], path: string): PathNode<T> | undefined {
        const normalized = PathManager.normalize(path);

        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].fullPath === normalized) {
                return nodes.splice(i, 1)[0];
            }
            const found = PathManager.removePath(nodes[i].children, normalized);
            if (found) return found;
        }

        return undefined;
    }

    /**
     * Rename a path and all its descendants.
     * Returns a map of old path -> new path for all affected nodes.
     */
    static renamePath<T = unknown>(
        nodes: PathNode<T>[],
        oldPath: string,
        newPath: string
    ): Map<string, string> {
        const affectedPaths = new Map<string, string>();
        const oldNorm = PathManager.normalize(oldPath);
        const newNorm = PathManager.normalize(newPath);

        const node = PathManager.findNode(nodes, oldNorm);
        if (!node) return affectedPaths;

        const collectPaths = (n: PathNode<T>): void => {
            affectedPaths.set(n.fullPath, n.fullPath.replace(oldNorm, newNorm));
            for (const child of n.children) {
                collectPaths(child);
            }
        };
        collectPaths(node);

        PathManager.removePath(nodes, oldNorm);

        const updatePaths = (n: PathNode<T>): void => {
            n.fullPath = n.fullPath.replace(oldNorm, newNorm);
            n.name = PathManager.displayName(n.fullPath);
            for (const child of n.children) {
                updatePaths(child);
            }
        };
        updatePaths(node);

        const newParent = PathManager.parentPath(newNorm);
        if (newParent === '/') {
            nodes.push(node);
            nodes.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            let parent = PathManager.findNode(nodes, newParent);
            if (!parent) {
                parent = PathManager.addPath(nodes, newParent);
            }
            parent.children.push(node);
            parent.children.sort((a, b) => a.name.localeCompare(b.name));
        }

        return affectedPaths;
    }

    /**
     * Get all paths in the tree as a flat array
     */
    static flatPaths<T = unknown>(nodes: PathNode<T>[]): string[] {
        const result: string[] = [];
        const collect = (ns: PathNode<T>[]) => {
            for (const n of ns) {
                result.push(n.fullPath);
                collect(n.children);
            }
        };
        collect(nodes);
        return result;
    }

    /**
     * Check if a path exists in the tree
     */
    static hasPath<T = unknown>(nodes: PathNode<T>[], path: string): boolean {
        return PathManager.findNode(nodes, path) !== undefined;
    }
}
