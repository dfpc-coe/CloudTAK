<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Links'
        >
            <template #icon>
                <IconLink
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <TablerIconButton
                    v-if='props.edit'
                    title='Add Link'
                    class='me-2'
                    @click.stop='addLink'
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
                    {{ props.modelValue.length }}
                </TablerBadge>
            </template>

            <div class='overflow-hidden mb-2'>
                <div class='cloudtak-accent rounded mx-2 mt-2 px-2 py-2'>
                    <div
                        v-if='!props.modelValue.length && !creating'
                        class='px-1 py-1 text-muted'
                    >
                        No links
                    </div>

                    <div
                        v-for='(link, index) of props.modelValue'
                        :key='index'
                        class='rounded border-0 bg-default mb-2 px-2 py-2'
                    >
                        <template v-if='editing === index'>
                            <div class='d-flex align-items-center mb-2'>
                                <div class='subheader user-select-none'>
                                    Link
                                </div>
                                <div class='ms-auto d-flex align-items-center flex-nowrap'>
                                    <TablerIconButton
                                        title='Save Link'
                                        @click='saveLink(index)'
                                    >
                                        <IconCheck
                                            :size='18'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                    <TablerIconButton
                                        title='Remove Link'
                                        @click='removeLink(index)'
                                    >
                                        <IconTrash
                                            :size='18'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </div>
                            </div>

                            <TablerInput
                                v-model='draft.name'
                                label='Name'
                                placeholder='Incident Report'
                                class='pb-2'
                            />

                            <TablerInput
                                v-model='draft.url'
                                label='URL'
                                placeholder='https://example.com'
                            />
                        </template>

                        <div
                            v-else
                            class='d-flex align-items-center'
                        >
                            <a
                                v-if='link.url'
                                :href='link.url'
                                target='_blank'
                                rel='noopener noreferrer'
                                class='d-flex align-items-center text-reset text-decoration-none flex-fill overflow-hidden'
                            >
                                <IconExternalLink
                                    :size='18'
                                    stroke='1'
                                    class='me-2 flex-shrink-0'
                                />
                                <span class='text-truncate'>{{ link.name || link.url }}</span>
                            </a>
                            <div
                                v-else
                                class='text-muted flex-fill'
                            >
                                {{ link.name || 'Untitled Link' }}
                            </div>

                            <TablerIconButton
                                v-if='props.edit'
                                title='Edit Link'
                                @click='startEditing(index)'
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
                        class='rounded border-0 bg-default mb-2 px-2 py-2'
                    >
                        <div class='d-flex align-items-center mb-2'>
                            <div class='subheader user-select-none'>
                                Link
                            </div>
                            <div class='ms-auto d-flex align-items-center flex-nowrap'>
                                <TablerIconButton
                                    title='Save Link'
                                    @click='saveNewLink'
                                >
                                    <IconCheck
                                        :size='18'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                                <TablerIconButton
                                    title='Discard Link'
                                    @click='cancelNewLink'
                                >
                                    <IconTrash
                                        :size='18'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>

                        <TablerInput
                            v-model='draft.name'
                            label='Name'
                            placeholder='Incident Report'
                            class='pb-2'
                        />

                        <TablerInput
                            v-model='draft.url'
                            label='URL'
                            placeholder='https://example.com'
                        />
                    </div>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import { TablerBadge, TablerInput, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconLink, IconExternalLink, IconPlus, IconTrash, IconPencil, IconCheck } from '@tabler/icons-vue';
import type { CoreEventLink } from '../../../types.ts';

const props = defineProps<{
    /** Named URLs associated with the Event */
    modelValue: Array<CoreEventLink>;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Array<CoreEventLink>): void
}>();

const expanded = ref(false);
const editing = ref<number | null>(null);
const creating = ref(false);
const draft = ref<CoreEventLink>({ name: '', url: '' });

function addLink(): void {
    creating.value = true;
    editing.value = null;
    draft.value = { name: '', url: '' };
    expanded.value = true;
}

function startEditing(index: number): void {
    creating.value = false;
    editing.value = index;
    draft.value = { ...props.modelValue[index] };
    expanded.value = true;
}

function saveLink(index: number): void {
    emit('update:modelValue', props.modelValue.map((link, it) => {
        return it === index ? { ...draft.value } : link;
    }));

    editing.value = null;
}

function removeLink(index: number): void {
    editing.value = null;
    emit('update:modelValue', props.modelValue.filter((_, it) => it !== index));
}

function saveNewLink(): void {
    emit('update:modelValue', [...props.modelValue, { ...draft.value }]);

    creating.value = false;
    draft.value = { name: '', url: '' };
}

function cancelNewLink(): void {
    creating.value = false;
    draft.value = { name: '', url: '' };
}
</script>
