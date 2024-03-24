<template>
<div class='row g-2'>
    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!visibleContacts.length' :create='false'/>
    <template v-else>
        <div :key='a.id' v-for='a of visibleContacts' class="col-lg-12">
            <Contact
                :contact='a'
                :buttonChat='false'
                :buttonZoom='false'
                :selected='selected.has(a)'
                @click='selected.has(a) ? selected.delete(a) : selected.add(a)'
            />
        </div>
    </template>

    <div class='col-6' style='padding-left: 20px;'>
        <button @click='share' class='w-100 btn btn-primary'>Share to Selected</button>
    </div>
    <div class='col-6' style='padding-right: 20px;'>
        <button @click='broadcast' class='w-100 btn btn-secondary'>Broadcast to All</button>
    </div>
    <div @click='$emit("done")'class='col-12 py-2' style='padding-right: 20px; padding-left: 20px;'>
        <button class='w-100 btn btn-secondary'>Cancel</button>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import Contact from '../partial/Contact.vue';
import { useConnectionStore } from '/src/stores/connection.ts';
import {
    IconCircleFilled,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

const connectionStore = useConnectionStore();

export default {
    name: 'Share',
    props: {
        feat: {
            type: Object,
            required: true,
        }
    },
    data: function() {
        return {
            err: false,
            loading: true,
            selected: new Set(),
            contacts: [],
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    computed: {
        visibleContacts: function() {
            return this.contacts.filter((contact) => {
                return contact.callsign;
            }).filter((contact) => {
                return true;
            })
        }
    },
    methods: {
        share: async function() {
            if (!this.selected.size) {
                throw new Error('No Users Selected to Share With');
            }
        },
        broadcast: async function() {

        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/marti/api/contacts/all');
            this.contacts = await std(url);
            this.loading = false;
        },
    },
    components: {
        Contact,
        TablerNone,
        TablerLoading,
        IconCircleFilled,
        IconCircleArrowLeft,
    }
}
</script>
