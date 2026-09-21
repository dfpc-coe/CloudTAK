import handlebars from 'handlebars';
import sanitizer from 'sanitize-html';

handlebars.registerHelper('fallback', (...params: Array<unknown>) => {
    params.pop(); // Contains Config stuff from handlebars
    const found = params.find(el => !!el);
    return found;
});

handlebars.registerHelper('slice', (text: string, start: number, end?: number) => {
    if (text && !isNaN(Number(start)) && !isNaN(Number(end))) {
        return text.substring(start, end);
    } else if (text && !isNaN(Number(start))) {
        return text.substring(start);
    } else {
        return '';
    }
});

handlebars.registerHelper('htmlstrip', (text: string) => {
    if (!text) return '';

    let addLine = false;
    let addSpace = false;
    const newLine = ['tr'];
    const newSpace = ['td'];

    return sanitizer(text, {
        allowedTags: [],
        onCloseTag: (tagName) => {
            addLine = newLine.includes(tagName);
            addSpace = newSpace.includes(tagName);
        },
        textFilter: (text) => {
            if (addLine) {
                addLine = false;
                text = '\n' + text;
            }

            if (addSpace) {
                addSpace = false;
                text = ': ' + text;
            }

            return text;
        },
    }).trim();
});

// Replace all occurrences of a search string with replacement text
// Usage: {{replace currentMessage '[nl]' ' '}} or chained {{replace (replace text '[nl]' ' ') '[np]' ' '}}
handlebars.registerHelper('replace', (text: string, search: string, replacement: string) => {
    if (!text) return '';
    return text.replaceAll(search, replacement);
});

// Round numbers to specified decimal places (defaults to 2)
// Usage: {{round depth 2}} or {{round magnitude 1}}
handlebars.registerHelper('round', (number: number, decimals: number = 2) => {
    if (number == null || isNaN(number)) return '';
    return Number(number).toFixed(decimals);
});

export default handlebars;
