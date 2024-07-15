<template>
    <div class='mb-2'>
        <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
            <div
                v-if='compact'
                class='ms-auto'
            >
                <IconX
                    v-tooltip='"Cancel Share"'
                    class='cursor-pointer mx-2 my-2'
                    :size='20'
                    :stroke='1'
                    @click='$emit("cancel")'
                />
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <TablerNone
            v-else-if='!visibleContacts.length'
            :create='false'
        />
        <template v-else>
            <div
                class='overflow-auto'
                :style='`
                    height: calc(100% - 36px - ${compact ? "30px" : "100px"});
                    margin-bottom: ${compact ? "30px" : "100px"};
                `'
            >
                <Contact
                    v-for='a of visibleContacts'
                    :key='a.id'
                    :compact='compact'
                    :contact='a'
                    :button-chat='false'
                    :button-zoom='false'
                    :selected='selected.has(a)'
                    @click='selected.has(a) ? selected.delete(a) : selected.add(a)'
                />
            </div>
            <div class='position-absolute row g-0 bottom-0 start-0 end-0 bg-dark'>
                <div
                    :class='{
                        "col-6 px-1": compact,
                        "col-4 px-1": !compact
                    }'
                >
                    <button
                        v-tooltip='"Share to Selected"'
                        class='w-100 btn btn-primary'
                        :style='compact ? "height: 30px" : ""'
                        @click='share'
                    >
                        <IconShare2
                            v-if='compact'
                            :size='20'
                            :stroke='1'
                        />
                        <span v-else>Share to Selected</span>
                    </button>
                </div>
                <div
                    :class='{
                        "col-6 px-1": compact,
                        "col-4 px-1": !compact
                    }'
                >
                    <button
                        v-tooltip='"Broadcast to All"'
                        class='w-100 btn btn-secondary'
                        :style='compact ? "height: 30px" : ""'
                        @click='broadcast'
                    >
                        <IconBroadcast
                            v-if='compact'
                            :size='20'
                            :stroke='1'
                        />
                        <span v-else>Broadcast to All</span>
                    </button>
                </div>
                <div
                    v-if='!compact'
                    class='col-4 px-1 pb-1'
                >
                    <button
                        v-tooltip='"Cancel Share"'
                        class='w-100 btn btn-secondary'
                        :style='compact ? "height: 30px" : ""'
                        @click='$emit("cancel")'
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </template>
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
import Contact from '../util/Contact.vue';
import { useConnectionStore } from '/src/stores/connection.ts';
import { useCOTStore } from '/src/stores/cots.ts';

const cotStore = useCOTStore();
const connectionStore = useConnectionStore();

export default {
    name: 'COTShare',
    components: {
        Contact,
        IconX,
        IconBroadcast,
        IconShare2,
        TablerNone,
        TablerLoading,
    },
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
    emits: [
        'cancel',
        'done'
    ],
    data: function() {
        return {
            err: false,
            loading: true,
            selected: new Set(),
            contacts: [],
        }
    },
    computed: {
        visibleContacts: function() {
            return this.contacts.filter((contact) => {
                return contact.callsign;
            })
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        /** Feats often come from Vector Tiles which don't contain the full feature */
        currentFeats: function() {
            return this.feats.map((f) => {
                if (f.properties.type === 'b-f-t-r') {
                    // FileShare is manually generated and won't exist in CoT Store
                    return f;
                } else {
                    return cotStore.get(f.id);
                }
            }).filter((f) => {
                return !!f;
            });
        },
        share: async function() {
            if (!this.selected.size) {
                throw new Error('No Users Selected to Share With');
            }

            const feats = this.currentFeats();

            if (feats.length === 1) {
                for (const contact of this.selected) {
                    const feat = JSON.parse(JSON.stringify(feats[0]));
                    feat.properties.dest = [{ uid: contact.uid }];
                    connectionStore.sendCOT(feat);
                }
            } else {
                await std('/api/marti/package', {
                    method: 'PUT',
                    body: {
                        type: 'FeatureCollection',
                        uids: Array.from(this.selected).map((contact) => { return contact.uid }),
                        features: feats.map((f) => {
                            f = JSON.parse(JSON.stringify(f));
                            return { id: f.id || f.properties.id, type: f.type, properties: f.properties, geometry: f.geometry }
                        })
                    }
                });
            }

            this.$emit('done');
        },
        broadcast: async function() {
            const feats = this.currentFeats();

            if (feats.length === 1) {
                connectionStore.sendCOT(JSON.parse(JSON.stringify(feats[0])));
                this.$emit('done');
            } else {
                await std('/api/marti/package', {
                    method: 'PUT',
                    body: {
                        type: 'FeatureCollection',
                        features: feats.map((f) => {
                            f = JSON.parse(JSON.stringify(f));
                            return { id: f.id || f.properties.id, type: f.type, properties: f.properties, geometry: f.geometry }
                        })
                    }
                });
            }
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/marti/api/contacts/all');
            this.contacts = await std(url);
            this.loading = false;
        },
    }
}
</script>
