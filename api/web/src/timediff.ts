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

        if (elapsed < msPerMinute) return Math.round(elapsed/1000) + ` second${Math.round(elapsed/1000) > 1 ? "s" : ""} ago`;
        if (elapsed < msPerHour) return Math.round(elapsed/msPerMinute) + ` minute${Math.round(elapsed/msPerMinute) > 1 ? "s" : ""} ago`;
        if (elapsed < msPerDay ) return Math.round(elapsed/msPerHour ) + ` hour${Math.round(elapsed/msPerHour) > 1 ? "s" : ""} ago`;
        if (elapsed < msPerMonth) return '~' + Math.round(elapsed/msPerDay) + ` day${Math.round(elapsed/msPerDay) > 1 ? "s" : ""} ago`;
        if (elapsed < msPerYear) return '~' + Math.round(elapsed/msPerMonth) + ` month${Math.round(elapsed/msPerMonth) > 1 ? "s" : ""} ago`;
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
