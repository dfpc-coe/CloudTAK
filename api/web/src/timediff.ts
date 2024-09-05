export default function(updated: string | number): string {
    if (typeof updated === 'string') {
        updated = +new Date(updated)
    }

    const now = +new Date();

    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const msPerMonth = msPerDay * 30;
    const msPerYear = msPerDay * 365;

    if (updated < now) {
        const elapsed = now - updated;

        if (elapsed < msPerMinute) return Math.round(elapsed/1000) + ' seconds ago';
        if (elapsed < msPerHour) return Math.round(elapsed/msPerMinute) + ' minutes ago';
        if (elapsed < msPerDay ) return Math.round(elapsed/msPerHour ) + ' hours ago';
        if (elapsed < msPerMonth) return '~' + Math.round(elapsed/msPerDay) + ' days ago';
        if (elapsed < msPerYear) return '~' + Math.round(elapsed/msPerMonth) + ' months ago';
        return '~' + Math.round(elapsed/msPerYear ) + ' years ago';
    } else {
        const elapsed = updated - now;

        if (elapsed < msPerMinute) return 'in ' + Math.round(elapsed/1000) + ' seconds';
        if (elapsed < msPerHour) return 'in ' + Math.round(elapsed/msPerMinute) + ' minutes';
        if (elapsed < msPerDay ) return 'in ' + Math.round(elapsed/msPerHour ) + ' hours';
        if (elapsed < msPerMonth) return 'in ~' + Math.round(elapsed/msPerDay) + ' days';
        if (elapsed < msPerYear) return 'in ~' + Math.round(elapsed/msPerMonth) + ' months';
        return 'in ~' + Math.round(elapsed/msPerYear ) + ' years';
    }
}
