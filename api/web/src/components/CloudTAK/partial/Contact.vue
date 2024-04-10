<template>
<div class='col-12 py-2 d-flex hover-dark cursor-pointer'>
    <div class='row col-12 align-items-center'>
        <div class='col-auto'>
            <IconCheck
                v-if='selected'
                :size='compact ? 20 : 32'
                :style='compact ? "margin-left: 8px" : "margin-left: 16px;"'
            />
            <IconCircleFilled v-else
                :style='compact ? "margin-left: 8px" : "margin-left: 16px;"'
                :size='compact ? 20 : 32'
                :class='{
                    "text-yellow": contact.team === "Yellow",
                    "text-cyan": contact.team === "Cyan",
                    "text-lime": contact.team === "Green",
                    "text-red": contact.team === "Red",
                    "text-purple": contact.team === "Purple",
                    "text-orange": contact.team === "Orange",
                    "text-azure": contact.team === "Blue",
                    "text-dribble": contact.team === "Magenta",
                    "text-white": contact.team === "White",
                    "text-pinterest": contact.team === "Maroon",
                    "text-blue": contact.team === "Dark Blue",
                    "text-teal": contact.team === "Teal",
                    "text-green": contact.team === "Dark Green",
                    "text-google": contact.team === "Brown",
                }'
            />
        </div>
        <div :class='{
            "col-7": buttonChat || buttonZoom,
            "col-9": !buttonChat && !buttonZoom
        }'>
            <div class='text-truncate' v-text='contact.callsign'></div>
            <div v-text='contact.notes.trim()' class='text-truncate subheader'></div>
        </div>
        <div v-if='buttomChat || buttonZoom' class='col-auto ms-auto btn-list'>
            <IconMessage
                @click='$emit("chat", contact.uid)'
                v-if='buttonChat && isChatable(contact)'
                v-tooltip='"Start Chat"'
                size='32'
                class='cursor-pointer'
            />
            <IconZoomPan
                @click='flyTo(contact)'
                v-if='buttonZoom && isZoomable(contact)'
                v-tooltip='"Zoom To"'
                size='32'
                class='cursor-pointer'
            />
        </div>
    </div>
</div>
</template>

<script>
import {
    IconCheck,
    IconMessage,
    IconZoomPan,
    IconCircleFilled,
} from '@tabler/icons-vue';
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'TAKContact',
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
        compact: {
            type: Boolean,
            default: false
        }
    },
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
            const flyTo = {
                speed: Infinity,
                center: cotStore.cots.get(contact.uid).geometry.coordinates,
                zoom: 16
            };

            if (mapStore.map.getZoom() < 3) flyTo.zoom = 4;
            mapStore.map.flyTo(flyTo)
        },
    },
    components: {
        IconCheck,
        IconMessage,
        IconZoomPan,
        IconCircleFilled,
    }
}
</script>
