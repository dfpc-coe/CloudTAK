<template>
<div class='position-relative mb-2' :style='`height: ${maxheight}`'>
    <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
        <div class='subheader mx-2 my-2'>Share</div>
        <div v-if='compact' class='ms-auto'>
            <IconX @click='$emit("cancel")' class='cursor-pointer mx-2 my-2' size='20' v-tooltip='"Cancel Share"'/>
        </div>
    </div>
    <div
        class='overflow-auto row g-1'
        :style='`height: calc(${maxheight} - 36px - 30px);`'
        style='margin-bottom: 30px;'
    >
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
    </div>
    <div class='position-absolute row g-0 bottom-0 start-0 end-0'>
        <div class='col-6 px-2'>
            <button
                @click='share'
                class='w-100 btn btn-primary'
                :style='compact ? "height: 30px" : ""'
                v-tooltip='"Share to Selected"'
            >
                <IconShare2 v-if='compact' size='20'/>
                <span v-else>Broadcast to All</span>
            </button>
        </div>
        <div class='col-6 px-2'>
            <button
                @click='broadcast' 
                class='w-100 btn btn-secondary'
                :style='compact ? "height: 30px" : ""'
                v-tooltip='"Broadcast to All"'
            >
                <IconBroadcast v-if='compact' size='20'/>
                <span v-else>Broadcast to All</span>
            </button>
        </div>
        <div v-if='!compact' @click='$emit("cancel")' class='col-12'>
            <button class='w-100 btn btn-secondary'>Cancel</button>
        </div>
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
    IconX,
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
        },
        maxheight: {
            type: String,
            default: '100%'
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
        IconX,
        IconBroadcast,
        IconShare2,
        TablerNone,
        TablerLoading,
    }
}
</script>
