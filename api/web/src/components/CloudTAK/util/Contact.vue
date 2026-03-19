<template>
    <StandardItem
        class='d-flex flex-row gap-3 mb-2 align-items-center'
        :class='{
            "cursor-pointer": zoomable,
            "cursor-default": !zoomable,
            "hover": hover,
            "contact-card--no-notes": !contact.notes || !contact.notes.trim()
        }'
        :hover='hover'
        @click='flyTo(contact)'
    >
        <div class='icon-wrapper ms-2 d-flex align-items-center justify-content-center rounded-circle'>
            <IconCheck
                v-if='selected'
                :size='compact ? 20 : 32'
                stroke='1'
            />
            <ContactPuck
                v-else
                :team='contact.team'
                :size='compact ? 20 : 32'
            />
        </div>

        <div
            class='flex-grow-1 d-flex flex-column gap-1'
            :class='{
                "py-2": !compact,
                "justify-content-center": !contact.notes || !contact.notes.trim()
            }'
        >
            <div class='d-flex flex-wrap align-items-center gap-2'>
                <span
                    class='fw-semibold text-break'
                    v-text='contact.callsign'
                />
            </div>
            <div
                v-if='contact.notes && contact.notes.trim()'
                class='text-break subheader user-select-none'
                v-text='contact.notes.trim()'
            />
        </div>

        <div
            v-if='props.buttonChat'
            class='align-self-center me-2'
        >
            <IconMessage
                v-if='props.buttonChat && chatable'
                v-tooltip='"Start Chat"'
                :size='compact ? 20 : 32'
                stroke='1'
                class='cursor-pointer'
                @click.stop='emit("chat", contact)'
            />
        </div>

        <div
            v-if='$slots.actions'
            class='align-self-center me-2'
        >
            <slot name='actions' />
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import { ref, watchEffect } from 'vue';
import {
    IconCheck,
    IconMessage,
} from '@tabler/icons-vue';
import ContactPuck from './ContactPuck.vue';
import StandardItem from './StandardItem.vue';
import { useMapStore } from '../../../stores/map.ts';
import type { Contact } from '../../../types.ts';

const mapStore = useMapStore();

const props = withDefaults(defineProps<{
    contact: Contact;
    flyToClick?: boolean;
    selected?: boolean;
    buttonChat?: boolean;
    hover?: boolean;
    compact?: boolean;
}>(), {
    flyToClick: true,
    selected: false,
    buttonChat: true,
    hover: true,
    compact: false
});

const emit = defineEmits<{
    chat: [contact: Contact];
}>();

const zoomable = ref(false);
const chatable = ref(false);

function hasEndpoint(val: unknown): val is { endpoint: unknown } {
    return typeof val === 'object' && val !== null && 'endpoint' in val;
}

watchEffect(async () => {
    zoomable.value = await mapStore.worker.db.has(props.contact.uid);

    if (!zoomable.value) {
        chatable.value = false;
        return;
    }
    const cot = await mapStore.worker.db.get(props.contact.uid);
    if (!cot) {
        chatable.value = false;
        return;
    }
    const contactProp = cot.properties['contact'];
    chatable.value = hasEndpoint(contactProp) && Boolean(contactProp.endpoint);
});

async function flyTo(contact: Contact): Promise<void> {
    if (!zoomable.value || !props.flyToClick) return;

    const cot = await mapStore.worker.db.get(contact.uid);
    if (!cot) return;

    cot.flyTo();
}
</script>

<style scoped>
.icon-wrapper {
    width: 3rem;
    height: 3rem;
    min-width: 3rem;
    min-height: 3rem;
    flex-shrink: 0;
}

.contact-card--no-notes {
    height: 50px;
}
</style>
