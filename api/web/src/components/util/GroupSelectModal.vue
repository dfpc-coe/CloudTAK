<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-white' />
        <div class='position-absolute top-0 end-0 z-2 d-flex align-items-center gap-2 mt-3 me-3'>
            <TablerBadge
                class='rounded-pill d-inline-flex align-items-center justify-content-center gap-1 px-2 py-1 text-center'
                background-color='rgba(36, 163, 255, 0.15)'
                border-color='rgba(36, 163, 255, 0.35)'
                text-color='#24a3ff'
                :title='`${selectedCount} selected channel${selectedCount === 1 ? "" : "s"}`'
            >
                <IconChecks
                    :size='14'
                    stroke='2'
                />
                <span v-text='selectedCount' />
            </TablerBadge>
            <button
                type='button'
                class='btn-close position-static m-0'
                aria-label='Close'
                @click='emit("close")'
            />
        </div>
        <div class='modal-header text-body'>
            <div class='d-flex align-items-center'>
                <IconBroadcast
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>Share to Channels</span>
            </div>
        </div>
        <div
            class='modal-body overflow-auto'
            style='max-height: 50vh;'
        >
            <TablerLoading v-if='loading' />
            <GroupSelect
                v-else
                v-model='selectedNames'
                :active='true'
            />
        </div>
        <div class='modal-footer'>
            <TablerButton
                class='w-100'
                variant='primary'
                @click='submit'
            >
                Save
            </TablerButton>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { computed, ref, onMounted } from 'vue';
import {
    TablerModal,
    TablerButton,
    TablerLoading,
    TablerBadge,
} from '@tak-ps/vue-tabler';
import { IconBroadcast, IconChecks } from '@tabler/icons-vue';
import GroupSelect from './GroupSelect.vue';
import type { Group } from '../../../src/types.ts';
import GroupManager from '../../base/group.ts';

const props = defineProps<{
    modelValue: Array<number>;
}>();

const emit = defineEmits<{
    close: [];
    submit: [channels: Array<number>];
}>();

const loading = ref(true);
const groups = ref<Group[]>([]);
const selectedNames = ref<string[]>([]);
const selectedCount = computed(() => selectedNames.value.length);

onMounted(async () => {
    const list = GroupManager.explode(await GroupManager.list());
    groups.value = list;

    // Resolve bitpos values to channel names for initial selection
    const bitposSet = new Set(props.modelValue);
    selectedNames.value = list
        .filter((g) => bitposSet.has(Number(g.bitpos)))
        .map((g) => g.name)
        .filter((name, i, arr) => arr.indexOf(name) === i);

    loading.value = false;
});

function submit() {
    // Convert selected names back to bitpos values
    const nameSet = new Set(selectedNames.value);
    const bitposValues = groups.value
        .filter((g) => nameSet.has(g.name))
        .map((g) => Number(g.bitpos))
        .filter((bp, i, arr) => arr.indexOf(bp) === i);

    emit('submit', bitposValues);
}
</script>
