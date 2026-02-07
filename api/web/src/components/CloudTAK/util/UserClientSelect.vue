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
}>();

const emit = defineEmits(['select', 'update:modelValue']);

const contacts = ref<ContactType[]>([]);
const filter = ref(props.modelValue || '');

const filteredList = computed(() => {
    if (!filter.value) {
        // Return initial list if no filter
        return contacts.value.slice(0, props.limit || 10);
    }
    
    return contacts.value.filter(c => {
        return c.callsign.toLowerCase().includes(filter.value.toLowerCase());
    }).slice(0, props.limit || 10);
});

onMounted(async () => {
    const { data } = await server.GET('/api/marti/clients', {
        params: {
            query: {
                secago: 7 * 24 * 60 * 60,
                group: props.groups
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

// Sync filter changes back to parent if using v-model
watch(filter, (val) => {
    emit('update:modelValue', val);
});

watch(() => props.modelValue, (val) => {
    if (val !== undefined) filter.value = val;
});
</script>
