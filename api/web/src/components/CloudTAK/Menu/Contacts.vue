<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Contacts</div>
            <div class='btn-list'>
                <IconRefresh v-if='!loading' @click='fetchList' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!contacts.length' :create='false'/>
    <template v-else>
        <div :key='a.id' v-for='a of visibleContacts' class="col-lg-12">
            <div class='row col-12 py-2 px-2 d-flex align-items-center hover-dark cursor-pointer'>
                <div class='col-auto'>
                    <IconCircleFilled :class='{
                        "text-yellow": a.team === "Yellow",
                        "text-cyan": a.team === "Cyan",
                        "text-lime": a.team === "Green",
                        "text-red": a.team === "Red",
                        "text-purple": a.team === "Purple",
                        "text-orange": a.team === "Orange",
                        "text-azure": a.team === "Blue",
                        "text-dribble": a.team === "Magenta",
                        "text-white": a.team === "White",
                        "text-pinterest": a.team === "Maroon",
                        "text-blue": a.team === "Dark Blue",
                        "text-teal": a.team === "Teal",
                        "text-green": a.team === "Dark Green",
                        "text-google": a.team === "Brown",
                    }'/>
                </div>
                <div class='col-auto'>
                    <div v-text='a.callsign'></div>
                    <div v-text='a.notes.trim()' class='subheader'></div>
                </div>
                <div class='col-auto ms-auto btn-list'>
                    <IconMessage @click='$emit("chat", a.uid)' v-if='isChatable(a)' v-tooltip='"Start Chat"' class='cursor-pointer'/>
                    <IconZoomPan @click='flyTo(a)' v-if='isZoomable(a)' v-tooltip='"Zoom To"' class='cursor-pointer'/>
                </div>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconMessage,
    IconZoomPan,
    IconRefresh,
    IconCircleFilled,
    IconCircleArrowLeft
} from '@tabler/icons-vue';
import { useCOTStore } from '/src/stores/cots.js';
const cotStore = useCOTStore();
import { useMapStore } from '/src/stores/map.js';
const mapStore = useMapStore();

export default {
    name: 'Contacts',
    data: function() {
        return {
            err: false,
            loading: true,
            contacts: []
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    computed: {
        visibleContacts: function() {
            return this.contacts.filter((contact) => {
                return contact.callsign;
            });
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
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/marti/api/contacts/all');
            this.contacts = await window.std(url);
            this.loading = false;
        },
    },
    components: {
        IconMessage,
        IconZoomPan,
        TablerNone,
        TablerLoading,
        IconRefresh,
        IconCircleFilled,
        IconCircleArrowLeft,
    }
}
</script>
