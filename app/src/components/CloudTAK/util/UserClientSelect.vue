<template>
    <div class='d-flex flex-column'>
        <TablerInput
            v-if='input'
            v-model='filter'
            class='mt-2'
            :placeholder='placeholder'
            @keyup.enter='emit("select", { callsign: filter })'
        />
        <div
            v-if='filteredList.length'
            class='mt-2'
            style='max-height: 200px; overflow-y: auto;'
        >
            <Contact
                v-for='contact in filteredList'
                :key='contact.uid'
                :contact='contact'
                :hoist='false'
                :button-chat='false'
                @click='emit("select", contact)'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed, watch } from 'vue';
import { server } from '../../../std.ts';
import { TablerInput } from '@tak-ps/vue-tabler';
import Contact from './Contact.vue';
import type { Contact as ContactType } from '../../../types.ts';

const props = defineProps<{
    placeholder?: string;
    modelValue?: string;
    input?: boolean;
    limit?: number;
    groups?: string[];
    excludeUids?: string[];
    excludeCallsigns?: string[];
}>();

const emit = defineEmits(['select', 'update:modelValue']);

const contacts = ref<ContactType[]>([]);
const filter = ref(props.modelValue || '');

const excludedUids = computed(() => new Set(props.excludeUids || []));
const excludedCallsigns = computed(() => new Set((props.excludeCallsigns || []).map(c => c.toLowerCase())));

const filteredList = computed(() => {
    const list = contacts.value.filter(c => {
        if (excludedUids.value.has(c.uid)) return false;
        if (excludedCallsigns.value.has(c.callsign.toLowerCase())) return false;
        if (!filter.value) return true;
        return c.callsign.toLowerCase().includes(filter.value.toLowerCase());
    });

    return list.slice(0, props.limit || 10);
});

onMounted(async () => {
    const groups = props.groups?.filter(Boolean);

    const { data } = await server.GET('/api/marti/clients', {
        params: {
            query: {
                secago: 7 * 24 * 60 * 60,
                groups: groups?.length ? groups.join(',') : undefined
            }
        }
    });

    contacts.value = (data?.data || []).map((c) => {
        return {
            uid: c.uid,
            callsign: c.callsign,
            role: c.role,
            team: c.team,
            notes: c.lastStatus,
            takv: '',
            filterGroups: null
        };
    });
});

watch(filter, (val) => {
    emit('update:modelValue', val);
});

watch(() => props.modelValue, (val) => {
    if (val !== undefined) filter.value = val;
});
</script>
