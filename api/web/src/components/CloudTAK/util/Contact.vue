<template>
    <div
        class='col-12'
        :class='{
            "cursor-pointer": isZoomable(contact),
            "cursor-default": !isZoomable(contact),
            "hover": hover,
            "py-2": !compact
        }'
        @click='flyTo(contact)'
    >
        <div class='row col-12 align-items-center'>
            <div class='col-auto'>
                <IconCheck
                    v-if='selected'
                    :size='compact ? 20 : 32'
                    stroke='1'
                    :style='compact ? "margin-left: 8px" : "margin-left: 16px;"'
                />
                <ContactPuck
                    v-else
                    :team='contact.team'
                    :compact='compact'
                />
            </div>
            <div
                :class='{
                    "col-7": props.buttonChat || buttonZoom,
                    "col-9": !props.buttonChat && !buttonZoom
                }'
            >
                <div
                    class='text-truncate user-select-none'
                    v-text='contact.callsign'
                />
                <div
                    class='text-truncate subheader user-select-none'
                    v-text='contact.notes ? contact.notes.trim() : ""'
                />
            </div>
            <div
                v-if='props.buttonChat || buttonZoom'
                class='col-auto ms-auto btn-list'
            >
                <IconMessage
                    v-if='props.buttonChat && isChatable(contact)'
                    v-tooltip='"Start Chat"'
                    :size='compact ? 20 : 32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='emit("chat", contact)'
                />
            </div>
        </div>
    </div>
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
    buttonZoom: {
        type: Boolean,
        default: true
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
    if (!props.buttonZoom || !await isZoomable(contact)) return;

    const cot = await mapStore.worker.db.get(contact.uid);
    if (!cot) return;

    cot.flyTo();
}
</script>
