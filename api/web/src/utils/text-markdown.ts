const FENCE = /^\s*(```|~~~)/;
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
 * Prepare free text - CoT Remarks, CoreEvent Remarks, Mission Logs etc. - to be rendered as Markdown
 *
 * Line structure is left intact so block level Markdown such as tables, lists
 * & headings render. Single line breaks are expected to be preserved by the
 * renderer via `white-space: pre-wrap` on paragraphs
 */
export function textToMarkdown(text: string | number | undefined | null): string {
    const lines = dedent(String(text ?? '').replace(/\r\n?/g, '\n').split('\n'));

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
