import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';

/**
 * Track the rendered width of a dropdown trigger so its floating panel can be
 * sized to match it.
 *
 * `TablerDropdown` positions its menu against the trigger but sizes it from a
 * fixed `width` prop - a panel wider than its trigger spills sideways and reads
 * as belonging to whatever control sits next to it.
 */
export function useTriggerWidth(
    el: Ref<HTMLElement | undefined>,
    /**
     * Floor for the panel width - a trigger narrower than this gets a panel
     * that overhangs it rather than one too cramped for a search field
     */
    minimum = 240,
): { width: Ref<number>, measure: () => void } {
    const width = ref(minimum);

    function measure(): void {
        if (!el.value) return;

        const measured = el.value.getBoundingClientRect().width;

        if (measured > 0) width.value = Math.max(measured, minimum);
    }

    let observer: ResizeObserver | undefined;

    onMounted(() => {
        measure();

        if (el.value && typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(measure);
            observer.observe(el.value);
        }

        window.addEventListener('resize', measure);
    });

    onBeforeUnmount(() => {
        if (observer) observer.disconnect();
        window.removeEventListener('resize', measure);
    });

    return { width, measure };
}
