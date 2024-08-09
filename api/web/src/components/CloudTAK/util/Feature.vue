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
        class='d-flex align-items-center px-3 py-2 me-2'
        :class='{
            "cursor-pointer": isZoomable,
            "cursor-default": !isZoomable,
            "hover-button": hover,
            "py-2": !compact
        }'
        @click='flyTo'
    >
        <IconMapPin
            :size='20'
            :stroke='1'
            class='me-2'
        />
        <div
            class='text-truncate'
            v-text='feature.properties.callsign'
        />

        <div
            class='ms-auto btn-list hover-button-hidden'
        >
            <TablerDelete
                :size='20'
                displaytype='icon'
                @click='deleteCOT'
            />
        </div>
    </div>
</template>

<script>
import Contact from './Contact.vue';
import {
    TablerDelete
} from '@tak-ps/vue-tabler';
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
        TablerDelete,
        IconMapPin
    },
    props: {
        feature: {
            type: Object,
            required: true
        },
        mission: {
            type: String,
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
            if (this.mission) {
                const cots = cotStore.subscriptions.get(this.mission)
                if (!cots) return false;
                return cots.has(this.feature.id);
            } else {
                return cotStore.cots.has(this.feature.id);
            }
        },
    },
    methods: {
        deleteCOT: async function() {
            await cotStore.delete(this.feature.id);
        },
        flyTo: function() {
            if (!this.isZoomable) return;

            let cot;
            if (this.mission) {
                const cots = cotStore.subscriptions.get(this.mission)
                if (!cots) return false;
                cot = cots.get(this.feature.id);
            } else {
                cot = cotStore.cots.get(this.feature.id);
            }

            if (cot.geometry.type === "Point") {
                const flyTo = {
                    speed: Infinity,
                    center: cot.properties.center,
                    zoom: 14
                };

                if (mapStore.map.getZoom() < 3) flyTo.zoom = 4;
                mapStore.map.flyTo(flyTo)
            } else {
                mapStore.map.fitBounds(cot.bounds(), {
                    maxZoom: 14,
                    padding: {
                        top: 20,
                        bottom: 20,
                        left: 20,
                        right: 20
                    },
                    speed: Infinity,
                })
            }
        },
    }
}
</script>
