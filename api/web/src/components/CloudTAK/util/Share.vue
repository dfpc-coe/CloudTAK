<template>
<div class='row g-2'>
    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!visibleContacts.length' :create='false'/>
    <template v-else>
        <div :key='a.id' v-for='a of visibleContacts' class="col-lg-12">
            <Contact
                :compact='compact'
                :contact='a'
                :buttonChat='false'
                :buttonZoom='false'
                :selected='selected.has(a)'
                @click='selected.has(a) ? selected.delete(a) : selected.add(a)'
            />
        </div>
    </template>

    <div class='col-6' style='padding-left: 20px;'>
        <button @click='share' class='w-100 btn btn-primary' v-tooltip='"Share to Selected"'>
            <IconShare2 v-if='compact' size='20'/>
            <span v-else>Broadcast to All</span>
        </button>
    </div>
    <div class='col-6' style='padding-right: 20px;'>
        <button @click='broadcast' class='w-100 btn btn-secondary' v-tooltip='"Broadcast to All"'>
            <IconBroadcast v-if='compact' size='20'/>
            <span v-else>Broadcast to All</span>
        </button>
    </div>
    <div @click='$emit("cancel")' class='col-12 py-2' style='padding-right: 20px; padding-left: 20px;'>
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
import {
    IconBroadcast,
    IconShare2
} from '@tabler/icons-vue';
import Contact from '../partial/Contact.vue';
import { useConnectionStore } from '/src/stores/connection.ts';

const connectionStore = useConnectionStore();

export default {
    name: 'COTShare',
    props: {
        feats: {
            type: Array,
            required: true,
        },
        compact: {
            type: Boolean,
            default: false
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
            })
        }
    },
    methods: {
        share: async function() {
            if (!this.selected.size) {
                throw new Error('No Users Selected to Share With');
            }

            if (this.feats.length === 1) {
                for (const contact of this.selected) {
                    const feat = JSON.parse(JSON.stringify(this.feats[0]));
                    feat.properties.dest = [{ uid: contact.uid }];
                    connectionStore.sendCOT(feat);
                }
            } else {
                // TODO Data Package
            }

            this.$emit('done');
        },
        broadcast: async function() {
            connectionStore.sendCOT(this.feat);
            this.$emit('done');
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
        IconBroadcast,
        IconShare2,
        TablerNone,
        TablerLoading,
    }
}
</script>
