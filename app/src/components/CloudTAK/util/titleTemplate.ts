import Handlebars from 'handlebars';
import { server } from '../../../std.ts';
import type Overlay from '../../../base/overlay-class.ts';

// Handlebars' bundled typings omit the fields read here (a MustacheStatement
// has no path/params), so the node shapes used are declared locally
interface PathNode {
    type: 'PathExpression';
    original: string;
    parts: string[];
    data: boolean;
    depth: number;
}

interface LiteralNode {
    type: 'StringLiteral' | 'NumberLiteral' | 'BooleanLiteral';
    value: string | number | boolean;
}

interface CallNode {
    type: 'MustacheStatement' | 'SubExpression';
    path: ExpressionNode;
    params: ExpressionNode[];
    hash?: { pairs: unknown[] };
}

interface ContentNode {
    type: 'ContentStatement';
    value: string;
}

type ExpressionNode = PathNode | LiteralNode | CallNode | { type: string };
type StatementNode = ContentNode | CallNode | { type: string };

type Helper = (...args: unknown[]) => unknown;

// Mirrors the helpers registered in api/common/handlebars.ts
const helpers: Record<string, Helper> = {
    fallback: (...args) => args.find((arg) => !!arg),
    slice: (text, start, end) => {
        if (typeof text !== 'string' || !text || isNaN(Number(start))) return '';
        if (!isNaN(Number(end))) return text.substring(Number(start), Number(end));
        return text.substring(Number(start));
    },
    htmlstrip: (text) => {
        if (typeof text !== 'string' || !text) return '';

        const doc = new DOMParser().parseFromString(text, 'text/html');
        for (const td of doc.body.querySelectorAll('td')) td.append(': ');
        for (const tr of doc.body.querySelectorAll('tr')) tr.append('\n');

        return (doc.body.textContent || '').replace(/[ \t]+/g, ' ').trim();
    },
    replace: (text, search, replacement) => {
        if (typeof text !== 'string' || !text) return '';
        return text.replaceAll(String(search), String(replacement));
    },
    round: (num, decimals = 2) => {
        if (num == null || isNaN(Number(num))) return '';
        return Number(num).toFixed(Number(decimals));
    }
};

/**
 * Render a Basemap/Overlay title template against feature properties by
 * walking the Handlebars AST. Handlebars.compile() builds the template
 * function with `new Function()`, which the served Content-Security-Policy
 * blocks; Handlebars.parse() only produces an AST.
 *
 * Output is plain text (values are not HTML-escaped). Block helpers,
 * partials, hash arguments and unknown helpers throw.
 *
 * @returns the trimmed title, or null if it renders to nothing
 */
export function renderTitleTemplate(template: string, properties: Record<string, unknown>): string | null {
    let source = template.trim();
    if (!source.length) return null;

    if (/^[a-zA-Z0-9_]+$/.test(source)) {
        source = `{{${source}}}`;
    }

    const program = Handlebars.parse(source);
    let out = '';

    for (const statement of program.body as unknown as StatementNode[]) {
        if (statement.type === 'ContentStatement') {
            out += (statement as ContentNode).value;
        } else if (statement.type === 'MustacheStatement') {
            out += stringify(evaluate(statement as CallNode, properties));
        } else if (statement.type !== 'CommentStatement') {
            throw new Error(`Unsupported template statement: ${statement.type}`);
        }
    }

    return out.trim() || null;
}

function evaluate(node: CallNode, properties: Record<string, unknown>): unknown {
    if (node.path.type !== 'PathExpression') {
        throw new Error(`Unsupported expression: ${node.path.type}`);
    }

    if (node.hash && node.hash.pairs.length) {
        throw new Error('Hash arguments are not supported');
    }

    const path = node.path as PathNode;
    const helper = helpers[path.original];

    if (node.params.length) {
        if (!helper) throw new Error(`Unknown helper: ${path.original}`);
        return helper(...node.params.map((param) => value(param, properties)));
    }

    return helper ? helper() : lookup(path, properties);
}

function value(node: ExpressionNode, properties: Record<string, unknown>): unknown {
    switch (node.type) {
        case 'PathExpression':
            return lookup(node as PathNode, properties);
        case 'SubExpression':
            return evaluate(node as CallNode, properties);
        case 'StringLiteral':
        case 'NumberLiteral':
        case 'BooleanLiteral':
            return (node as LiteralNode).value;
        case 'NullLiteral':
        case 'UndefinedLiteral':
            return undefined;
        default:
            throw new Error(`Unsupported expression: ${node.type}`);
    }
}

function lookup(path: PathNode, properties: Record<string, unknown>): unknown {
    if (path.data || path.depth > 0) {
        throw new Error(`Unsupported path: ${path.original}`);
    }

    let current: unknown = properties;
    for (const part of path.parts) {
        if (current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }

    return current;
}

function stringify(input: unknown): string {
    if (typeof input === 'string') return input;
    if (typeof input === 'number' || typeof input === 'boolean') return String(input);
    return '';
}

/**
 * Fetch the title template configured on the Basemap behind an overlay, or
 * null when the overlay is not basemap-backed or has no template
 */
export async function fetchTitleTemplate(overlay: Overlay | null | undefined): Promise<string | null> {
    if (!overlay || !overlay.mode_id || !['basemap', 'overlay'].includes(overlay.mode)) return null;

    const { data } = await server.GET('/api/basemap/{:basemapid}', {
        params: { path: { ':basemapid': Number(overlay.mode_id) } }
    });

    if (data && typeof data === 'object' && 'title' in data && typeof data.title === 'string' && data.title) {
        return data.title;
    }

    return null;
}

/**
 * Display title for a feature: the rendered template when one applies,
 * otherwise the name or callsign property, otherwise the fallback
 */
export function featureTitle(
    properties: Record<string, unknown> | null | undefined,
    template: string | null | undefined,
    fallback = 'No Name'
): string {
    const props = properties || {};

    if (template) {
        try {
            const result = renderTitleTemplate(template, props);
            if (result) return result;
        } catch (err) {
            console.warn(`Feature title template "${template}" failed to render`, err);
        }
    }

    const name = props.name;
    if (typeof name === 'string' && name.trim()) return name;

    const callsign = props.callsign;
    if (typeof callsign === 'string' && callsign.trim()) return callsign;

    return fallback;
}
