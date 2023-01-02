export default function(updated) {
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const msPerMonth = msPerDay * 30;
    const msPerYear = msPerDay * 365;
    const elapsed = +(new Date()) - updated;

    if (elapsed < msPerMinute) return Math.round(elapsed/1000) + ' seconds ago';
    if (elapsed < msPerHour) return Math.round(elapsed/msPerMinute) + ' minutes ago';
    if (elapsed < msPerDay ) return Math.round(elapsed/msPerHour ) + ' hours ago';
    if (elapsed < msPerMonth) return '~' + Math.round(elapsed/msPerDay) + ' days ago';
    if (elapsed < msPerYear) return '~' + Math.round(elapsed/msPerMonth) + ' months ago';
    return '~' + Math.round(elapsed/msPerYear ) + ' years ago';
}
