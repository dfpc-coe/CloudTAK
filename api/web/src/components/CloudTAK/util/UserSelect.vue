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
import { ref, onMounted, computed } from 'vue';
import { TablerInput } from '@tak-ps/vue-tabler';
import Contact from './Contact.vue';
import { useMapStore } from '../../../stores/map.ts';
import type { Contact as ContactType } from '../../../types.ts';

const props = defineProps<{
    placeholder?: string;
    modelValue?: string;
    input?: boolean;
    limit?: number;
}>();

const emit = defineEmits(['select', 'update:modelValue']);

const mapStore = useMapStore();
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
    contacts.value = await mapStore.worker.team.list();
    filter.value = '';
});

// Sync filter changes back to parent if using v-model
import { watch } from 'vue';
watch(filter, (val) => {
    emit('update:modelValue', val);
});

watch(() => props.modelValue, (val) => {
    if (val !== undefined) filter.value = val;
});
</script>
