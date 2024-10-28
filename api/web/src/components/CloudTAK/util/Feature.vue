<template>
    <Contact
        v-if='feature.properties.group'
        class='px-2 py-2'
        :button-chat='false'
        :compact='compact'
        :contact='{
            "uid": feature.id,
            "callsign": feature.properties.callsign,
            "team": feature.properties.group.name,
            "notes": ""
        }'
    />
    <div
        v-else
        class='d-flex align-items-center px-3 py-2'
        :class='{
            "cursor-pointer": isZoomable,
            "cursor-default": !isZoomable,
            "hover-button": hover,
            "py-2": !compact
        }'
        @click='flyTo'
    >
        <span class='me-2'>
            <IconLine
                v-if='feature.geometry && feature.geometry.type === "LineString"'
                :size='20'
                :color='feature.properties.stroke || "white"'
                stroke='1'
            />
            <IconCone
                v-else-if='feature.properties && feature.properties.sensor'
                :size='20'
                :color='feature.properties.stroke || "white"'
                stroke='1'
            />
            <IconPolygon
                v-else-if='feature.geometry && feature.geometry.type === "Polygon"'
                :size='20'
                :color='feature.properties.fill || "white"'
                stroke='1'
            />
            <IconMapPin
                v-else
                :size='20'
                stroke='1'
            />
        </span>
        <div
            class='text-truncate user-select-none'
            style='width: 180px;'
            v-text='feature.properties.callsign || feature.properties.name || "Unnamed"'
        />

        <div
            v-if='deleteButton'
            class='ms-auto btn-list hover-button-hidden'
        >
            <TablerDelete
                v-if='deleteAction === "delete"'
                :size='20'
                displaytype='icon'
                @delete='deleteCOT'
            />
            <IconTrash
                v-else
                :size='20'
                @click='deleteCOT'
                class='cursor-pointer'
                :stroke='1'
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
    IconMapPin,
    IconTrash,
    IconLine,
    IconCone,
    IconPolygon,
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
        IconMapPin,
        IconTrash,
        IconLine,
        IconCone,
        IconPolygon,
    },
    emits: ['delete'],
    props: {
        feature: {
            type: Object,
            required: true
        },
        mission: {
            type: String,
        },
        deleteButton: {
            type: Boolean,
            default: true
        },
        deleteAction: {
            type: String,
            default: 'delete' //emit or delete
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
                const sub = cotStore.subscriptions.get(this.mission)
                if (!sub) return false;
                return sub.cots.has(this.feature.id);
            } else {
                return cotStore.cots.has(this.feature.id);
            }
        },
    },
    methods: {
        deleteCOT: async function() {
            if (this.deleteAction === 'delete') {
                await cotStore.delete(this.feature.id);
            } else {
                this.$emit('delete');
            }
        },
        flyTo: function() {
            if (!this.isZoomable) return;

            let cot;
            if (this.mission) {
                const sub = cotStore.subscriptions.get(this.mission)
                if (!sub) return false;
                cot = sub.cots.get(this.feature.id);
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
