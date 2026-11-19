<template>
    <PropertySection label='Links'>
        <template #actions>
            <TablerIconButton
                v-if='props.edit'
                title='Add Link'
                @click.stop='addLink'
            >
                <IconPlus
                    :size='20'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <TablerNone
            v-if='!props.modelValue.length && !creating'
            label='No Links'
            class='pb-2'
            :compact='true'
            :create='false'
        />

        <template
            v-for='(link, index) of props.modelValue'
            :key='index'
        >
            <div
                v-if='editing === index'
                class='rounded mb-2 px-2 py-2 cloudtak-accent'
            >
                <LinkFields
                    v-model='draft'
                    @save='saveLink(index)'
                    @cancel='editing = null'
                />
            </div>

            <div
                v-else
                class='link-row d-flex align-items-center gap-2 px-2 rounded'
            >
                <a
                    v-if='link.url'
                    :href='link.url'
                    :target='link.url.startsWith("tel:") ? undefined : "_blank"'
                    rel='noopener noreferrer'
                    class='d-flex align-items-center gap-2 text-reset text-decoration-none flex-fill'
                    style='min-width: 0; min-height: 36px;'
                >
                    <IconPhone
                        v-if='link.url.startsWith("tel:")'
                        :size='18'
                        stroke='1'
                        class='text-secondary flex-shrink-0'
                    />
                    <IconLink
                        v-else
                        :size='18'
                        stroke='1'
                        class='text-secondary flex-shrink-0'
                    />
                    <span
                        class='text-truncate'
                        :title='link.url'
                        v-text='link.name || link.url'
                    />
                </a>
                <div
                    v-else
                    class='d-flex align-items-center gap-2 text-secondary flex-fill'
                    style='min-width: 0; min-height: 36px;'
                >
                    <IconLink
                        :size='18'
                        stroke='1'
                        class='flex-shrink-0'
                    />
                    <span
                        class='text-truncate'
                        v-text='link.name || "Untitled Link"'
                    />
                </div>

                <div
                    v-if='props.edit'
                    class='link-row-actions btn-list flex-nowrap flex-shrink-0'
                >
                    <TablerIconButton
                        title='Edit Link'
                        @click='startEditing(index)'
                    >
                        <IconPencil
                            :size='18'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerDelete
                        displaytype='icon'
                        :size='18'
                        @delete='removeLink(index)'
                    />
                </div>
            </div>
        </template>

        <div
            v-if='creating'
            class='rounded mb-2 px-2 py-2 cloudtak-accent'
        >
            <LinkFields
                v-model='draft'
                @save='saveNewLink'
                @cancel='cancelNewLink'
            />
        </div>
    </PropertySection>
</template>

<script setup lang='ts'>
/** PropertyCoreEntityLinks - the named URLs of a Core Entity as a compact row list */
import { ref } from 'vue';
import PropertySection from '../util/PropertySection.vue';
import LinkFields from './PropertyCoreEntityLinkFields.vue';
import { TablerIconButton, TablerDelete, TablerNone } from '@tak-ps/vue-tabler';
import { IconLink, IconPhone, IconPlus, IconPencil } from '@tabler/icons-vue';
import type { CoreEntityLink } from '../../../types.ts';

const props = defineProps<{
    /** Named URLs associated with the Event */
    modelValue: Array<CoreEntityLink>;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Array<CoreEntityLink>): void
}>();

const editing = ref<number | null>(null);
const creating = ref(false);
const draft = ref<CoreEntityLink>({ name: '', url: '' });

function addLink(): void {
    creating.value = true;
    editing.value = null;
    draft.value = { name: '', url: '' };
}

function startEditing(index: number): void {
    creating.value = false;
    editing.value = index;
    draft.value = { ...props.modelValue[index] };
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

<style scoped>
.link-row:hover {
    background: var(--cloudtak-hover-bg);
}

.link-row-actions {
    visibility: hidden;
}

.link-row:hover .link-row-actions,
.link-row:focus-within .link-row-actions {
    visibility: visible;
}
</style>
