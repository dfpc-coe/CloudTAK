<template>
    <div>
        <div class='sticky-top py-2 bg-dark'>
            <TablerInput
                v-model='filter'
                icon='search'
                placeholder='Filter Channels...'
            />
        </div>

        <div
            v-if='props.limit'
            class='alert alert-info mt-2'
            role='alert'
        >
            <div class='d-flex align-items-center'>
                <IconInfoCircle /><span class='mx-1'>Select up to&nbsp;<span v-text='props.limit' />&nbsp;Channel<span v-text='props.limit > 1 ? "s" : ""' /></span>
            </div>
        </div>

        <EmptyInfo v-if='mapStore.hasNoChannels' />

        <TablerLoading
            v-if='loading'
            desc='Loading Channels'
        />
        <TablerNone
            v-else-if='!filtered.length'
            :compact='true'
            label='Groups'
            :create='false'
        />
        <template v-else>
            <div
                style='max-height: 20vh;'
                class='my-2 mx-2 overflow-auto'
            >
                <div
                    v-for='group in filtered'
                    :key='`${group.name}-${group.direction}`'
                    class='col-12 cursor-pointer'
                    @click='updateGroup(group)'
                >
                    <IconCircleFilled
                        v-if='selected.has(group.name)'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                    />
                    <IconCircle
                        v-else
                        :size='32'
                        troke='1'
                        class='cursor-pointer'
                    />
                    <span
                        class='mx-2'
                        v-text='group.name'
                    />
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import EmptyInfo from '../util/EmptyInfo.vue';
import { useMapStore } from '../../../stores/map.ts';
import type { Group } from '../../../types.ts';
import {
    TablerLoading,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconCircle,
    IconInfoCircle,
    IconCircleFilled
} from '@tabler/icons-vue';

const mapStore = useMapStore();

const props = defineProps<{
    connection?: number,
    limit?: number,
    active?: boolean,
    direction?: string,
    modelValue: Array<string>
}>();

const emit = defineEmits([
    'update:modelValue'
]);

const filter = ref('');
const loading = ref(true);
const selected = ref<Set<string>>(new Set(props.modelValue))
const groups = ref<Array<Group>>([])

const filtered = computed(() => {
    return groups.value.filter((g) => {
        return g.name.toLowerCase().includes(filter.value.toLowerCase());
    });
})

onMounted(async () => {
    groups.value = (await mapStore.worker.profile.loadChannels()).filter((group) => {
        return props.active ? group.active : true;
    }).filter((group) => {
        return props.direction ? group.direction === props.direction : true;
    });
    loading.value = false;
});

function updateGroup(group: Group) {
    if (selected.value.has(group.name)) {
        selected.value.delete(group.name)
    } else {
        if (props.limit && selected.value.size >= props.limit) {
            throw new Error(`Cannot select more than ${props.limit} Channels`);
        }

        selected.value.add(group.name)
    }

    emit('update:modelValue', Array.from(selected.value));
}
</script>
