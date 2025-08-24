<template>
    <TablerModal
        size='lg'
    >
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <span class='modal-title'>Share Features</span>
            <button
                type='button'
                class='btn-close'
                aria-label='Close'
                @click='emit("cancel")'
            />
        </div>
        <div
            class='modal-body'
        >
            <div class='mx-2'>
                <TablerInput
                    v-model='filter'
                    icon='search'
                    label=''
                    placeholder='Filter...'
                />
            </div>
            <div
                class='px-2 py-2 round btn-group w-100'
                role='group'
            >
                <input
                    id='mode-users'
                    type='radio'
                    class='btn-check'
                    autocomplete='off'
                    :checked='mode === "users"'
                    @click='mode = "users"'
                >
                <label
                    for='mode-users'
                    type='button'
                    class='btn btn-sm'
                ><IconUsers
                    v-tooltip='"Users"'
                    :size='24'
                    stroke='1'
                /> <span class='ms-2'>Users</span></label>

                <input
                    id='mode-groups'
                    type='radio'
                    class='btn-check'
                    autocomplete='off'
                    :checked='mode === "groups"'
                    @click='mode = "groups"'
                >
                <label
                    for='mode-groups'
                    type='button'
                    class='btn btn-sm'
                ><IconAffiliate
                    v-tooltip='"Channels"'
                    :size='24'
                    stroke='1'
                /> <span class='ms-2'>Channels</span></label>
            </div>

            <div class='col-12'>
                <TablerLoading v-if='loading' />

                <template v-else-if='mode === "users"'>
                    <TablerNone
                        v-if='!visibleContacts.length'
                        :create='false'
                    />
                    <template v-else>
                        <div
                            class='overflow-auto'
                            style='max-height: 60vh;'
                        >
                            <COTContact
                                v-for='a of visibleContacts'
                                :key='a.uid'
                                :contact='a'
                                :button-chat='false'
                                :button-zoom='false'
                                :selected='selectedUsers.has(a)'
                                @click='selectedUsers.has(a) ? selectedUsers.delete(a) : selectedUsers.add(a)'
                            />
                        </div>
                    </template>
                </template>
                <template v-else-if='mode === "groups"'>
                    <TablerNone
                        v-if='!Object.keys(visibleChannels).length'
                        :create='false'
                    />
                    <template v-else>
                        <div
                            class='overflow-auto'
                            style='max-height: 60vh;'
                        >
                            <div
                                v-for='ch in visibleChannels'
                                :key='ch.name'
                                class='col-lg-12 py-2 px-2 hover rounded cursor-pointer user-select-none'
                                @click='selectedGroups.has(ch) ? selectedGroups.delete(ch) : selectedGroups.add(ch)'
                            >
                                <IconAffiliate
                                    v-if='!selectedGroups.has(ch)'
                                    :size='24'
                                    stroke='1'
                                />
                                <IconCheck
                                    v-else
                                    :size='24'
                                    stroke='1'
                                />
                                <span
                                    class='mx-2'
                                    v-text='ch.name'
                                />
                            </div>
                        </div>
                    </template>
                </template>
            </div>
        </div>
        <div class='modal-footer'>
            <div class='row g-2 w-100'>
                <div
                    class='col-6'
                >
                    <TablerButton
                        v-tooltip='"Share to Selected"'
                        :disabled='selectedUsers.size === 0 && selectedGroups.size === 0'
                        class='w-100 btn-primary'
                        @click='share'
                    >
                        <IconShare2
                            :size='20'
                            stroke='1'
                        />
                        <span>Share</span>
                    </TablerButton>
                </div>
                <div class='col-6'>
                    <TablerButton
                        v-tooltip='"Broadcast to All"'
                        class='w-100 btn-secondary'
                        @click='broadcast'
                    >
                        <IconBroadcast
                            :size='20'
                            stroke='1'
                        />
                        <span>Broadcast To All</span>
                    </TablerButton>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, computed,  onMounted, onBeforeUnmount } from 'vue';
import { std, stdurl } from '../../../std.ts';
import {
    TablerNone,
    TablerInput,
    TablerModal,
    TablerLoading,
    TablerButton,
} from '@tak-ps/vue-tabler';
import {
    IconUsers,
    IconCheck,
    IconBroadcast,
    IconAffiliate,
    IconShare2
} from '@tabler/icons-vue';
import type { Contact, ContactList, Feature, Group } from '../../../types.ts'
import type { WorkerMessage } from '../../../base/events.ts';
import COTContact from '../util/Contact.vue';
import { useMapStore } from '../../../stores/map.ts';
import { WorkerMessageType } from '../../../base/events.ts';

const mapStore = useMapStore();

const props = defineProps<{
    feats?: Feature[]
    basemaps?: number[],
}>();

const emit = defineEmits([
    'cancel',
    'done'
]);

const loading = ref(true);
const filter = ref('');
const mode = ref('users');

const selectedGroups = ref<Set<Group>>(new Set())
const selectedUsers = ref<Set<Contact>>(new Set())

const contacts = ref<ContactList>([]);
const channels = ref<Array<Group>>([]);

const visibleChannels = computed<Array<Group>>(() => {
    return channels.value.filter((channel) => {
        return channel.name.toLowerCase().includes(filter.value.toLowerCase());
    });
});

const visibleContacts = computed<ContactList>(() => {
    return contacts.value.filter((contact) => {
        return contact.callsign;
    }).filter((contact) => {
        return contact.callsign.toLowerCase().includes(filter.value.toLowerCase());
    })
});

const channel = new BroadcastChannel("cloudtak");

channel.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === WorkerMessageType.Contact_Change) {
        await fetchUserList();
    }
}

onMounted(async () => {
    await fetchUserList();
    await fetchChannelList();
});

onBeforeUnmount(() => {
    if (channel) {
        channel.close();
    }
});

/** Feats often come from Vector Tiles which don't contain the full feature */
async function currentFeats(): Promise<Feature[]> {
    const feats = [];

    for (const f of props.feats || []) {
        if (f.properties.type === 'b-f-t-r') {
            // FileShare is manually generated and won't exist in CoT Store
            feats.push(f);
        } else {
            const cot = await mapStore.worker.db.get(f.id)
            if (cot) feats.push(cot.as_feature());
        }
    }

    return feats;
}

async function share() {
    const feats = await currentFeats();

    // CoTs with Attachments must always be send via a DataPackage
    if (
        feats.length === 1
        && !props.basemaps
        && (!feats[0].properties.attachments || feats[0].properties.attachments.length === 0)
    ) {
        const feat = JSON.parse(JSON.stringify(feats[0]));
        feat.properties.dest = [];

        for (const contact of selectedUsers.value) {
            feat.properties.dest.push({ uid: contact.uid });
        }

        for (const group of selectedGroups.value) {
            feat.properties.dest.push({ group: group.name });
        }

        await mapStore.worker.conn.sendCOT(feat);
    } else {
        const destinations: Array<{ uid?: string, group?: string }> = [
            ...Array.from(selectedUsers.value).map((contact): { uid: string } => ({ uid: contact.uid })),
            ...Array.from(selectedGroups.value).map((group): { group: string } => ({ group: group.name })),
        ];

        await std('/api/marti/package', {
            method: 'PUT',
            body: {
                type: 'FeatureCollection',
                destinations,
                basemaps: props.basemaps || [],
                features: feats.map((f) => {
                    f = JSON.parse(JSON.stringify(f));
                    return { id: f.id || f.properties.id, type: f.type, properties: f.properties, geometry: f.geometry }
                })
            }
        });
    }

    emit('done');
}

async function broadcast() {
    const feats = await currentFeats();

    if (
        feats.length === 1
        && !props.basemaps
        && (!feats[0].properties.attachments || feats[0].properties.attachments.length === 0)
    ) {
        await mapStore.worker.conn.sendCOT(JSON.parse(JSON.stringify(feats[0])));
        emit('done');
    } else {
        await std('/api/marti/package', {
            method: 'PUT',
            body: {
                type: 'FeatureCollection',
                basemaps: props.basemaps || [],
                features: feats.map((f) => {
                    f = JSON.parse(JSON.stringify(f));

                    return {
                        id: f.id || f.properties.id,
                        type: f.type,
                        properties: f.properties,
                        geometry: f.geometry
                    }
                })
            }
        });
    }
}

async function fetchChannelList() {
    loading.value = true;

    channels.value = (await mapStore.worker.profile.loadChannels()).filter((channel) => {
        if (!channel.active) return false;
        if (channel.direction !== 'IN') return false;
        return true;
    });

    loading.value = false;
}

async function fetchUserList() {
    loading.value = true;
    const url = stdurl('/api/marti/api/contacts/all');
    contacts.value = await std(url) as ContactList;
    loading.value = false;
}
</script>
