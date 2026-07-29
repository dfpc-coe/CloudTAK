<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Channels'
        >
            <template #icon>
                <IconAffiliate
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <TablerIconButton
                    v-if='props.edit && !editing'
                    title='Edit Channels'
                    class='me-2'
                    @click.stop='startEditing'
                >
                    <IconPencil
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-else-if='props.edit'
                    title='Save Channels'
                    class='me-2'
                    @click.stop='save'
                >
                    <IconCheck
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerBadge
                    class='me-2'
                    background-color='rgba(59, 130, 246, 0.15)'
                    border-color='rgba(59, 130, 246, 0.4)'
                    text-color='#3b82f6'
                >
                    {{ props.modelValue.length }}
                </TablerBadge>
            </template>

            <div class='overflow-hidden mb-2'>
                <div class='cloudtak-accent rounded mx-2 mt-2 px-2 py-2'>
                    <TablerLoading
                        v-if='loading'
                        :compact='true'
                        desc='Loading Channels'
                    />
                    <template v-else-if='editing'>
                        <div
                            class='overflow-auto'
                            style='max-height: 250px;'
                        >
                            <GroupSelect v-model='selected' />
                        </div>
                    </template>
                    <template v-else>
                        <div
                            v-if='!names.length'
                            class='px-1 py-1 text-muted'
                        >
                            Not shared with any Channels
                        </div>
                        <div
                            v-for='name of names'
                            :key='name'
                            class='px-1 py-1 text-truncate'
                            v-text='name'
                        />
                    </template>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, watch } from 'vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import GroupSelect from '../../util/GroupSelect.vue';
import GroupManager from '../../../base/group.ts';
import type { GroupChannel } from '../../../types.ts';
import { TablerBadge, TablerLoading, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconAffiliate, IconPencil, IconCheck } from '@tabler/icons-vue';

const props = defineProps<{
    /** TAK Server Channel bitpositions the Event is shared with */
    modelValue: Array<number>;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Array<number>): void
}>();

const expanded = ref(false);
const editing = ref(false);
const loading = ref(true);
const channels = ref<Array<GroupChannel>>([]);
const selected = ref<Array<string>>([]);

// A Channel the user can't see resolves to no name - the bitpos is shown so
// the Event doesn't appear to be shared with fewer Channels than it is
const names = computed(() => {
    return props.modelValue.map((bitpos) => {
        const channel = channels.value.find((c) => c.bitpos === bitpos);
        return channel ? channel.name : `Channel ${bitpos}`;
    });
});

onMounted(async () => {
    channels.value = await GroupManager.list();
    loading.value = false;
});

watch(() => props.modelValue, () => {
    editing.value = false;
});

function startEditing(): void {
    selected.value = names.value;
    editing.value = true;
    expanded.value = true;
}

function save(): void {
    const bitpos = channels.value
        .filter((channel) => selected.value.includes(channel.name))
        .map((channel) => channel.bitpos);

    // Channels the user can't see aren't in the selector - preserve them or
    // saving would silently unshare the Event from them
    const hidden = props.modelValue.filter((channel) => {
        return !channels.value.some((c) => c.bitpos === channel);
    });

    editing.value = false;

    emit('update:modelValue', [...new Set([...bitpos, ...hidden])].sort((a, b) => a - b));
}
</script>
