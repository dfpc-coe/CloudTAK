<template>
    <div class='mb-2'>
        <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
            <span class='subheader mx-2'>Share Features</span>
            <div
                v-if='compact'
                class='ms-auto'
            >
                <TablerIconButton
                    title='Cancel Share'
                    class='mx-2 my-2'
                    @click='$emit("cancel")'
                >
                    <IconX
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <div class='mx-2'>
            <TablerInput
                v-model='filter'
                label=''
                placeholder='Filter...'
            />
        </div>

        <TablerLoading v-if='loading' />
        <TablerNone
            v-else-if='!visibleContacts.length'
            :create='false'
        />
        <template v-else>
            <div
                class='overflow-auto position-absolute'
                :style='`
                    height: calc(100% - 36px - ${compact ? "40px" : "100px"});
                    margin-bottom: ${compact ? "30px" : "100px"};
                    width: 100%;
                `'
            >
                <COTContact
                    v-for='a of visibleContacts'
                    :key='a.uid'
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
                        "col-6 px-1 py-1": compact,
                        "col-4 px-1 py-1": !compact
                    }'
                >
                    <TablerButton
                        v-tooltip='"Share to Selected"'
                        :disabled='selected.size === 0'
                        class='w-100 btn-primary'
                        :style='compact ? "height: 30px" : ""'
                        @click='share'
                    >
                        <IconShare2
                            v-if='compact'
                            :size='20'
                            stroke='1'
                        />
                        <span v-else>Share to Selected</span>
                    </TablerButton>
                </div>
                <div
                    :class='{
                        "col-6 px-1 py-1": compact,
                        "col-4 px-1 py-1": !compact
                    }'
                >
                    <TablerButton
                        v-tooltip='"Broadcast to All"'
                        class='w-100 btn-secondary'
                        :style='compact ? "height: 30px" : ""'
                        @click='broadcast'
                    >
                        <IconBroadcast
                            v-if='compact'
                            :size='20'
                            stroke='1'
                        />
                        <span v-else>Broadcast to All</span>
                    </TablerButton>
                </div>
                <div
                    v-if='!compact'
                    class='col-4 px-1 py-1 pb-1'
                >
                    <TablerButton
                        v-tooltip='"Cancel Share"'
                        class='w-100 btn-secondary'
                        :style='compact ? "height: 30px" : ""'
                        @click='$emit("cancel")'
                    >
                        Cancel
                    </TablerButton>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerButton,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconX,
    IconBroadcast,
    IconShare2
} from '@tabler/icons-vue';
import COT from '../../../base/cot.ts'
import type { Contact, ContactList, Feature } from '../../../types.ts'
import COTContact from '../util/Contact.vue';
import { useMapWorkerStore } from '../../../stores/worker.ts';

const mapWorkerStore = useMapWorkerStore();

const props = defineProps<{
    feats?: Feature[] | COT[],
    basemaps?: number[],
    compact?: boolean
}>();

const emit = defineEmits([
    'cancel',
    'done'
]);

const loading = ref(true);
const filter = ref('');
const selected = ref<Set<Contact>>(new Set())
const contacts = ref<ContactList>([]);

const visibleContacts = computed<ContactList>(() => {
    return contacts.value.filter((contact) => {
        return contact.callsign;
    }).filter((contact) => {
        return contact.callsign.toLowerCase().includes(filter.value.toLowerCase());
    })
});

onMounted(async () => {
    await fetchList();
});

/** Feats often come from Vector Tiles which don't contain the full feature */
function currentFeats(): Feature[] {
    return (props.feats || []).map((f) => {
        if (f.properties.type === 'b-f-t-r') {
            // FileShare is manually generated and won't exist in CoT Store
            return f;
        } else {
            const cot = mapWorkerStore.worker.get(f.id)
            if (cot) {
                return cot.as_feature();
            } else {
                return;
            }
        }
    }).filter((f) => {
        return !!f;
    }) as Feature[];
}

async function share() {
    const feats = currentFeats();

    // CoTs with Attachments must always be send via a DataPackage
    if (
        feats.length === 1
        && !props.basemaps
        && (!feats[0].properties.attachments || feats[0].properties.attachments.length === 0)
    ) {
        for (const contact of selected.value) {
            const feat = JSON.parse(JSON.stringify(feats[0]));
            feat.properties.dest = [{ uid: contact.uid }];
            mapWorkerStore.worker.sendCOT(feat);
        }
    } else {
        await std('/api/marti/package', {
            method: 'PUT',
            body: {
                type: 'FeatureCollection',
                uids: Array.from(selected.value).map((contact) => { return contact.uid }),
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
    const feats = currentFeats();

    if (
        feats.length === 1
        && !props.basemaps
        && (!feats[0].properties.attachments || feats[0].properties.attachments.length === 0)
    ) {
        mapWorkerStore.worker.sendCOT(JSON.parse(JSON.stringify(feats[0])));
        emit('done');
    } else {
        await std('/api/marti/package', {
            method: 'PUT',
            body: {
                type: 'FeatureCollection',
                basemaps: props.basemaps || [],
                features: feats.map((f) => {
                    f = JSON.parse(JSON.stringify(f));
                    return { id: f.id || f.properties.id, type: f.type, properties: f.properties, geometry: f.geometry }
                })
            }
        });
    }
}

async function fetchList() {
    loading.value = true;
    const url = stdurl('/api/marti/api/contacts/all');
    contacts.value = await std(url) as ContactList;
    loading.value = false;
}
</script>
