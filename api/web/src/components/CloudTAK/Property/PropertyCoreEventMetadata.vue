<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Metadata'
        >
            <template #icon>
                <IconListDetails
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <TablerIconButton
                    v-if='props.edit'
                    title='Add Metadata'
                    class='me-2'
                    @click.stop='addEntry'
                >
                    <IconPlus
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
                    {{ entries.length }}
                </TablerBadge>
            </template>

            <div class='overflow-hidden mb-2'>
                <div class='cloudtak-accent rounded mx-2 mt-2 px-2 py-2'>
                    <div
                        v-if='!entries.length && !creating'
                        class='px-1 py-1 text-muted'
                    >
                        No metadata
                    </div>

                    <div
                        v-for='entry of entries'
                        :key='entry.key'
                        class='d-flex align-items-center px-1 py-1'
                    >
                        <span
                            class='text-muted text-truncate'
                            style='min-width: 33%'
                            v-text='entry.key'
                        />
                        <span
                            class='mx-2 text-truncate flex-fill'
                            v-text='entry.display'
                        />
                        <TablerIconButton
                            v-if='props.edit'
                            title='Remove Metadata'
                            @click='removeEntry(entry.key)'
                        >
                            <IconTrash
                                :size='18'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>

                    <div
                        v-if='creating'
                        class='rounded border-0 bg-default mt-2 px-2 py-2'
                    >
                        <div class='d-flex align-items-center mb-2'>
                            <div class='subheader user-select-none'>
                                Metadata
                            </div>
                            <div class='ms-auto d-flex align-items-center flex-nowrap'>
                                <TablerIconButton
                                    title='Save Metadata'
                                    @click='saveEntry'
                                >
                                    <IconCheck
                                        :size='18'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                                <TablerIconButton
                                    title='Discard Metadata'
                                    @click='creating = false'
                                >
                                    <IconTrash
                                        :size='18'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>

                        <TablerInput
                            v-model='draft.key'
                            label='Key'
                            class='pb-2'
                        />

                        <TablerInput
                            v-model='draft.value'
                            label='Value'
                        />
                    </div>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import { TablerBadge, TablerInput, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconListDetails, IconPlus, IconTrash, IconCheck } from '@tabler/icons-vue';

const props = defineProps<{
    /** User defined key/value Event metadata */
    modelValue: Record<string, unknown>;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, unknown>): void
}>();

const expanded = ref(false);
const creating = ref(false);
const draft = ref({ key: '', value: '' });

const entries = computed(() => {
    return Object.keys(props.modelValue).sort().map((key) => {
        const value = props.modelValue[key];

        return {
            key,
            display: typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value)
        };
    });
});

function addEntry(): void {
    creating.value = true;
    draft.value = { key: '', value: '' };
    expanded.value = true;
}

function saveEntry(): void {
    const key = draft.value.key.trim();
    if (!key) return;

    emit('update:modelValue', {
        ...props.modelValue,
        [key]: draft.value.value
    });

    creating.value = false;
    draft.value = { key: '', value: '' };
}

function removeEntry(key: string): void {
    const metadata = { ...props.modelValue };
    delete metadata[key];
    emit('update:modelValue', metadata);
}
</script>
