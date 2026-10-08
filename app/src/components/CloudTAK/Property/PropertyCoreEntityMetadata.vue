<template>
    <PropertySection
        label='Metadata'
        :count='entries.length'
    >
        <template #actions>
            <TablerIconButton
                v-if='props.edit'
                title='Add Metadata'
                @click.stop='addEntry'
            >
                <IconPlus
                    :size='20'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <TablerNone
            v-if='!entries.length && !creating'
            label='No Metadata'
            :compact='true'
            :create='false'
        />

        <div
            v-for='entry of entries'
            :key='entry.key'
            class='d-flex align-items-center rounded px-1 py-1 cloudtak-hover-fill'
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
            class='rounded mt-2 px-2 py-2'
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
    </PropertySection>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import PropertySection from '../util/PropertySection.vue';
import { TablerInput, TablerIconButton, TablerNone } from '@tak-ps/vue-tabler';
import { IconPlus, IconTrash, IconCheck } from '@tabler/icons-vue';

const props = defineProps<{
    /** User defined key/value Event metadata */
    modelValue: Record<string, unknown>;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, unknown>): void
}>();

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
