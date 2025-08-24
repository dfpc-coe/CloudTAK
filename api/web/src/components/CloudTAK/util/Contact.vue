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
    try {
        const localCots = await mapStore.worker.db.list();
        for (const cot of localCots) {
            if (cot.is_skittle && cot.properties.callsign === contact.callsign) {
                return true;
            }
        }
    } catch (err) {
        console.warn('Error checking if contact is zoomable:', err);
    }
    return false;
}

async function isChatable(contact) {
    try {
        const localCots = await mapStore.worker.db.list();
        for (const cot of localCots) {
            if (cot.is_skittle && cot.properties.callsign === contact.callsign) {
                return cot.properties.contact && cot.properties.contact.endpoint;
            }
        }
    } catch (err) {
        console.warn('Error checking if contact is chatable:', err);
    }
    return false;
}

async function flyTo(contact) {
    if (!props.buttonZoom || !await isZoomable(contact)) return;

    try {
        const localCots = await mapStore.worker.db.list();
        for (const cot of localCots) {
            if (cot.is_skittle && cot.properties.callsign === contact.callsign) {
                await mapStore.worker.db.flyTo(cot.id);
                return;
            }
        }
    } catch (err) {
        console.warn('Error flying to contact:', err);
    }
}
</script>
