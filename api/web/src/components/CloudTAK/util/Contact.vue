<template>
    <article
        class='contact-card text-white d-flex flex-row gap-3 position-relative mb-2 align-items-center'
        :class='{
            "cursor-pointer": isZoomable(contact),
            "cursor-default": !isZoomable(contact),
            "hover": hover
        }'
        @click='flyTo(contact)'
    >
        <div class='contact-card__icon-wrapper ms-2 d-flex align-items-center justify-content-center rounded-circle'>
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
                    class='fw-semibold text-truncate'
                    v-text='contact.callsign'
                />
            </div>
            <div
                v-if='contact.notes && contact.notes.trim()'
                class='text-truncate subheader user-select-none'
                v-text='contact.notes.trim()'
            />
        </div>

        <div
            v-if='props.buttonChat'
            class='align-self-center me-2'
        >
            <IconMessage
                v-if='props.buttonChat && isChatable(contact)'
                v-tooltip='"Start Chat"'
                :size='compact ? 20 : 32'
                stroke='1'
                class='cursor-pointer'
                @click.stop='emit("chat", contact)'
            />
        </div>
    </article>
</template>

<script setup>
import {
    IconCheck,
    IconMessage,
} from '@tabler/icons-vue';
import ContactPuck from './ContactPuck.vue';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

const props = defineProps({
    contact: {
        type: Object,
        required: true
    },
    selected: {
        type: Boolean,
        default: false
    },
    buttonChat: {
        type: Boolean,
        default: true
    },
    hover: {
        type: Boolean,
        default: true
    },
    compact: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'chat'
]);

async function isZoomable(contact) {
    return mapStore.worker.db.has(contact.uid);
}

async function isChatable(contact) {
    if (!await mapStore.worker.db.has(contact.uid)) return false;
    const cot = await mapStore.worker.db.get(contact.uid);
    return cot.properties.contact && cot.properties.contact.endpoint;
}

async function flyTo(contact) {
    if (!await isZoomable(contact)) return;

    const cot = await mapStore.worker.db.get(contact.uid);
    if (!cot) return;

    cot.flyTo();
}
</script>

<style scoped>
.contact-card__icon-wrapper {
    width: 3rem;
    height: 3rem;
    min-width: 3rem;
    min-height: 3rem;
    flex-shrink: 0;
}

.contact-card {
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 14px;
    background-color: rgba(0, 0, 0, 0.35);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.contact-card:hover,
.contact-card:focus-within {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}
</style>
