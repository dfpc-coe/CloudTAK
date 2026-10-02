const FENCE = /^\s*(```|~~~)/;
const HTML = /^<(?:[a-z][a-z0-9-]*)(?:\s|>|\/>|$)/i;
const URL = /(?<![="'(<[])(https?:\/\/[a-z-]+[:.].*?)(?=[\s"|]|$)/g;

/**
 * Remove the indentation shared by every line
 *
 * Text built from an indented template literal would otherwise be
 * rendered as a Markdown code block
 */
function dedent(lines: string[]): string[] {
    const indents = lines
        .filter((line) => line.trim().length)
        .map((line) => line.length - line.trimStart().length);

    const shared = indents.length ? Math.min(...indents) : 0;

    return lines.map((line) => line.trim().length ? line.slice(shared) : '');
}

/**
 * Text that opens with an HTML tag (KML descriptions etc.) is nested markup
 * where indentation carries no meaning - any residual indent after a blank
 * line would otherwise become a Markdown code block
 */
function stripIndent(lines: string[]): string[] {
    const first = lines.find((line) => line.trim().length);

    if (!first || !HTML.test(first.trim())) return lines;

    return lines.map((line) => line.trimStart());
}

/**
 * Prepare free text - CoT Remarks, CoreEntity Remarks, Mission Logs etc. - to be rendered as Markdown
 *
 * Line structure is left intact so block level Markdown such as tables, lists
 * & headings render. Single line breaks are expected to be preserved by the
 * renderer via `white-space: pre-wrap` on paragraphs
 */
export function textToMarkdown(text: string | number | undefined | null): string {
    const lines = stripIndent(dedent(String(text ?? '').replace(/\r\n?/g, '\n').split('\n')));

    let fenced = false;

    return lines.map((line) => {
        if (FENCE.test(line)) {
            fenced = !fenced;
            return line;
        }

        // Bare URLs outside of a code fence are made clickable
        return fenced ? line : line.replace(URL, '[$1]($1)');
    }).join('\n').trim();
}
