<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='External IDs'
        >
            <template #icon>
                <IconHash
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <TablerIconButton
                    v-if='props.edit'
                    title='Add External ID'
                    class='me-2'
                    @click.stop='add'
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
                <div class='rounded mx-2 mt-2 px-2 py-2'>
                    <TablerNone
                        v-if='!entries.length && !creating'
                        label='No External IDs'
                        :compact='true'
                        :create='false'
                    />

                    <div
                        v-for='[system, value] of entries'
                        :key='system'
                        class='rounded mb-2 px-2 py-2'
                        :class='{ "cloudtak-hover-fill": editing !== system }'
                    >
                        <template v-if='editing === system'>
                            <div class='d-flex align-items-center mb-2'>
                                <div class='subheader user-select-none'>
                                    {{ system }}
                                </div>
                                <div class='ms-auto d-flex align-items-center flex-nowrap'>
                                    <TablerIconButton
                                        title='Save External ID'
                                        @click='save(system)'
                                    >
                                        <IconCheck
                                            :size='18'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                    <TablerIconButton
                                        title='Remove External ID'
                                        @click='remove(system)'
                                    >
                                        <IconTrash
                                            :size='18'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </div>
                            </div>

                            <TablerInput
                                v-model='draft.value'
                                label='ID'
                                placeholder='1234'
                            />
                        </template>

                        <div
                            v-else
                            class='d-flex align-items-center'
                        >
                            <span class='text-muted me-2 flex-shrink-0'>{{ system }}</span>
                            <CopyField
                                :model-value='value'
                                :edit='false'
                                :size='24'
                                class='flex-fill overflow-hidden'
                            />
                            <TablerIconButton
                                v-if='props.edit'
                                title='Edit External ID'
                                @click='startEditing(system, value)'
                            >
                                <IconPencil
                                    :size='18'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>

                    <div
                        v-if='creating'
                        class='rounded mb-2 px-2 py-2'
                    >
                        <div class='d-flex align-items-center mb-2'>
                            <div class='subheader user-select-none'>
                                External ID
                            </div>
                            <div class='ms-auto d-flex align-items-center flex-nowrap'>
                                <TablerIconButton
                                    title='Save External ID'
                                    :disabled='!valid'
                                    @click='saveNew'
                                >
                                    <IconCheck
                                        :size='18'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                                <TablerIconButton
                                    title='Discard External ID'
                                    @click='cancelNew'
                                >
                                    <IconTrash
                                        :size='18'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>

                        <TablerInput
                            v-model='draft.system'
                            label='System'
                            placeholder='active911, caltopo, cad'
                            description='Letters, numbers, dots, dashes & underscores'
                            class='pb-2'
                        />

                        <TablerInput
                            v-model='draft.value'
                            label='ID'
                            placeholder='1234'
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
import CopyField from '../util/CopyField.vue';
import { TablerBadge, TablerInput, TablerIconButton, TablerNone } from '@tak-ps/vue-tabler';
import { IconHash, IconPlus, IconTrash, IconPencil, IconCheck } from '@tabler/icons-vue';
import type { CoreEntityExternalId } from '../../../types.ts';

const SYSTEM = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

const props = defineProps<{
    /** IDs of the Event in external systems keyed by system */
    modelValue: Record<string, string>;
    edit?: boolean;
}>();

/** A single system/value pair - the API merges it into the Event's external IDs, an empty value removes the system */
const emit = defineEmits<{
    (e: 'update:modelValue', value: CoreEntityExternalId): void
}>();

const expanded = ref(false);
const editing = ref<string | null>(null);
const creating = ref(false);
const draft = ref<CoreEntityExternalId>({ system: '', value: '' });

const entries = computed(() => Object.entries(props.modelValue));
const valid = computed(() => SYSTEM.test(draft.value.system.trim()) && draft.value.value.trim() !== '');

function add(): void {
    creating.value = true;
    editing.value = null;
    draft.value = { system: '', value: '' };
    expanded.value = true;
}

function startEditing(system: string, value: string): void {
    creating.value = false;
    editing.value = system;
    draft.value = { system, value };
    expanded.value = true;
}

function save(system: string): void {
    emit('update:modelValue', { system, value: draft.value.value.trim() });
    editing.value = null;
}

function remove(system: string): void {
    editing.value = null;
    emit('update:modelValue', { system, value: '' });
}

function saveNew(): void {
    if (!valid.value) return;

    emit('update:modelValue', { system: draft.value.system.trim(), value: draft.value.value.trim() });

    creating.value = false;
    draft.value = { system: '', value: '' };
}

function cancelNew(): void {
    creating.value = false;
    draft.value = { system: '', value: '' };
}
</script>
