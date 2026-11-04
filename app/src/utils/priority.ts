/** Core Entity priorities in ascending order of urgency */
export const PRIORITIES = ['none', 'low', 'medium', 'high', 'critical'];

const COLOURS: Record<string, { background: string, border: string, text: string }> = {
    none: { background: 'rgba(107, 121, 144, 0.15)', border: 'rgba(107, 121, 144, 0.4)', text: '#6b7990' },
    low: { background: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#3b82f6' },
    medium: { background: 'rgba(245, 159, 0, 0.15)', border: 'rgba(245, 159, 0, 0.4)', text: '#f59f00' },
    high: { background: 'rgba(245, 101, 34, 0.15)', border: 'rgba(245, 101, 34, 0.4)', text: '#f56522' },
    critical: { background: 'rgba(214, 51, 108, 0.15)', border: 'rgba(214, 51, 108, 0.4)', text: '#d6336c' },
};

/** Badge colours & display label for a priority */
export function priorityBadge(priority: string): { background: string, border: string, text: string, label: string } {
    return {
        ...(COLOURS[priority] || COLOURS.none),
        label: priority.charAt(0).toUpperCase() + priority.slice(1),
    };
}
