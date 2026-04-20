<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-white' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
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
            class='modal-body'
            style='max-height: 50vh; overflow-y: auto;'
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
import { ref, onMounted } from 'vue';
import {
    TablerModal,
    TablerButton,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import { IconBroadcast } from '@tabler/icons-vue';
import GroupSelect from './GroupSelect.vue';
import type { Group } from '../../../src/types.ts';
import GroupManager from '../../base/group.ts';

const props = defineProps<{
    modelValue: Array<string>;
}>();

const emit = defineEmits<{
    close: [];
    submit: [channels: Array<string>];
}>();

const loading = ref(true);
const groups = ref<Group[]>([]);
const selectedNames = ref<string[]>([]);

onMounted(async () => {
    const list = GroupManager.explode(await GroupManager.list());
    groups.value = list;

    // Resolve bitpos strings to channel names for initial selection
    const bitposSet = new Set(props.modelValue.map(String));
    selectedNames.value = list
        .filter((g) => bitposSet.has(String(g.bitpos)))
        .map((g) => g.name)
        .filter((name, i, arr) => arr.indexOf(name) === i);

    loading.value = false;
});

function submit() {
    // Convert selected names back to bitpos strings
    const nameSet = new Set(selectedNames.value);
    const bitposValues = groups.value
        .filter((g) => nameSet.has(g.name))
        .map((g) => String(g.bitpos))
        .filter((bp, i, arr) => arr.indexOf(bp) === i);

    emit('submit', bitposValues);
}
</script>
