<template>
    <Contact
        v-if='feature.properties.group'
        :button-chat='false'
        :contact='{
            "uid": feature.id,
            "callsign": feature.properties.callsign,
            "team": feature.properties.group.name,
            "notes": ""
        }'
    />
    <div
        v-else
        class='col-12'
        :class='{
            "cursor-pointer": isZoomable,
            "cursor-default": !isZoomable,
            "hover-dark": hover,
            "py-2": !compact
        }'
        @click='flyTo'
    >
        <div class='row col-12 align-items-center'>
            <div class='col-auto'>
                <IconMapPin
                    :size='20'
                    :stroke='1'
                />
            </div>
            <div class='col-8'>
                <div
                    class='text-truncate'
                    v-text='feature.properties.callsign'
                />
            </div>
        </div>
    </div>
</template>

<script>
import Contact from './Contact.vue';
import {
    IconMapPin
} from '@tabler/icons-vue';
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'TAKFeature',
    components: {
        Contact,
        IconMapPin
    },
    props: {
        feature: {
            type: Object,
            required: true
        },
        hover: {
            type: Boolean,
            default: true
        },
        compact: {
            type: Boolean,
            default: true
        }
    },
    computed: {
        isZoomable: function() {
            return cotStore.cots.has(this.feature.id);
        },
    },
    methods: {
        flyTo: function() {
            if (!this.isZoomable) return;

            const flyTo = {
                speed: Infinity,
                center: cotStore.cots.get(this.feature.id).properties.center,
                zoom: 16
            };

            if (mapStore.map.getZoom() < 3) flyTo.zoom = 4;
            mapStore.map.flyTo(flyTo)
        },
    }
}
</script>
