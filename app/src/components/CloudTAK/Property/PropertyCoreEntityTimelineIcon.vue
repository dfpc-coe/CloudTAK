<template>
    <div
        class='timeline-icon d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle'
        :class='muted ? "timeline-icon--muted" : `timeline-icon--${type}`'
        :title='label'
    >
        <component
            :is='icon'
            :size='15'
            stroke='1.75'
        />
    </div>
</template>

<script setup lang='ts'>
/** PropertyCoreEntityTimelineIcon - the rail icon of a Timeline entry, coloured by its type */
import { computed } from 'vue';
import {
    IconMessage,
    IconActivity,
    IconUsers,
    IconMapPin,
    IconPaperclip,
    IconExternalLink,
} from '@tabler/icons-vue';
import type { CoreEntityTimelineType } from '../../../types.ts';

const ICONS = {
    comment: { icon: IconMessage, label: 'Comment' },
    status: { icon: IconActivity, label: 'Status' },
    unit: { icon: IconUsers, label: 'Unit' },
    location: { icon: IconMapPin, label: 'Location' },
    attachment: { icon: IconPaperclip, label: 'Attachment' },
    external: { icon: IconExternalLink, label: 'External' },
};

const props = defineProps<{
    type: CoreEntityTimelineType;
    muted?: boolean;
}>();

const icon = computed(() => (ICONS[props.type] || ICONS.comment).icon);
const label = computed(() => (ICONS[props.type] || ICONS.comment).label);
</script>

<style scoped>
.timeline-icon {
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
}

.timeline-icon--muted {
    background: var(--cloudtak-inset-bg);
    color: var(--tblr-secondary-color);
}

.timeline-icon--comment { background: rgba(59, 130, 246, 0.18); color: #6ea8f0; }
.timeline-icon--status { background: rgba(245, 159, 0, 0.18); color: #f59f00; }
.timeline-icon--unit { background: rgba(47, 179, 68, 0.18); color: #4cc764; }
.timeline-icon--location { background: rgba(174, 62, 201, 0.18); color: #c47ad8; }
.timeline-icon--attachment { background: var(--cloudtak-inset-bg); color: var(--tblr-body-color); }
.timeline-icon--external { background: rgba(23, 162, 184, 0.18); color: #3cc2d8; }
</style>
