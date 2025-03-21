<template>
    <div
        class='col-12'
        :class='{
            "cursor-pointer": isZoomable(contact),
            "cursor-default": !isZoomable(contact),
            "hover-dark": hover,
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
                    :contact='contact'
                    :compact='compact'
                />
            </div>
            <div
                :class='{
                    "col-7": buttonChat || buttonZoom,
                    "col-9": !buttonChat && !buttonZoom
                }'
            >
                <div
                    class='text-truncate user-select-none'
                    v-text='contact.callsign'
                />
                <div
                    class='text-truncate subheader user-select-none'
                    v-text='contact.notes.trim()'
                />
            </div>
            <div
                v-if='buttonChat || buttonZoom'
                class='col-auto ms-auto btn-list'
            >
                <IconMessage
                    v-if='buttonChat && isChatable(contact)'
                    v-tooltip='"Start Chat"'
                    :size='compact ? 20 : 32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='$emit("chat", contact)'
                />
            </div>
        </div>
    </div>
</template>

<script>
import {
    IconCheck,
    IconMessage,
} from '@tabler/icons-vue';
import ContactPuck from './ContactPuck.vue';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'TAKContact',
    components: {
        IconCheck,
        IconMessage,
        ContactPuck
    },
    props: {
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
    },
    emits: [
        'chat'
    ],
    methods: {
        isZoomable: async function(contact) {
            return mapStore.worker.db.has(contact.uid);
        },
        isChatable: async function(contact) {
            if (!await mapStore.worker.db.has(contact.uid)) return false;
            const cot = await mapStore.worker.db.get(contact.uid);
            return cot.properties.contact && cot.properties.contact.endpoint;
        },
        flyTo: async function(contact) {
            if (!this.buttonZoom || !await this.isZoomable(contact)) return;

            const cot = await mapStore.worker.db.get(contact.uid);
            if (!cot) return;

            cot.flyTo();
        }
    }
}
</script>
