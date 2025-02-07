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
                    class='text-truncate subheader'
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
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();
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
        isZoomable: function(contact) {
            return cotStore.cots.has(contact.uid);
        },
        isChatable: function(contact) {
            if (!cotStore.cots.has(contact.uid)) return false;
            const cot = cotStore.cots.get(contact.uid);
            return cot.properties.contact && cot.properties.contact.endpoint;
        },
        flyTo: function(contact) {
            if (!this.buttonZoom || !this.isZoomable(contact)) return;

            const flyTo = {
                speed: Infinity,
                center: cotStore.cots.get(contact.uid).geometry.coordinates,
                zoom: 16
            };

            if (mapStore.map.getZoom() < 3) flyTo.zoom = 4;
            mapStore.map.flyTo(flyTo)
        },
    }
}
</script>
