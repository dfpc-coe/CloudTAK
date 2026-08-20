<template>
    <div class='form-attach-select'>
        <div
            v-if='props.modelValue.length'
            class='rounded border mb-2'
        >
            <div
                v-for='attachment of props.modelValue'
                :key='attachment.form.id'
                class='d-flex align-items-center gap-2 px-2 py-2 form-attach-row'
            >
                <IconForms
                    :size='18'
                    stroke='1.5'
                    class='flex-shrink-0 text-secondary'
                />
                <div
                    class='flex-grow-1'
                    style='min-width: 0;'
                >
                    <div
                        class='text-truncate'
                        v-text='attachment.form.name'
                    />
                    <div
                        v-if='attachment.form.description'
                        class='small text-secondary text-truncate'
                        v-text='attachment.form.description'
                    />
                </div>
                <button
                    type='button'
                    class='badge border-0 flex-shrink-0 cursor-pointer'
                    :class='attachment.required ? "bg-red-lt" : "bg-secondary-lt"'
                    :title='attachment.required ? "The Form must be completed - click to make it optional" : "The Form is optional - click to make it required"'
                    :disabled='props.disabled'
                    @click='setRequired(attachment, !attachment.required)'
                    v-text='attachment.required ? "Required" : "Optional"'
                />
                <TablerIconButton
                    title='Remove Form'
                    :disabled='props.disabled'
                    @click='remove(attachment)'
                >
                    <IconTrash
                        :size='18'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <TablerDropdown
            :width='menuWidth'
            position='bottom-start'
            class='w-100'
        >
            <template #default>
                <div
                    ref='trigger'
                    class='form-select d-flex align-items-center gap-2 w-100 form-attach-trigger'
                    :class='{ "cursor-pointer": !props.disabled }'
                    role='button'
                    :tabindex='props.disabled ? -1 : 0'
                    aria-label='Attach a Form'
                >
                    <IconForms
                        :size='18'
                        stroke='1.5'
                        class='flex-shrink-0 text-secondary'
                    />
                    <span
                        class='flex-grow-1 text-truncate text-secondary user-select-none'
                        style='min-width: 0;'
                    >Attach a Form</span>
                </div>
            </template>

            <template #dropdown>
                <div
                    class='form-attach-menu'
                    :style='{ width: `${menuWidth}px` }'
                >
                    <div class='d-flex align-items-center px-3 py-2 border-bottom'>
                        <h3 class='m-0 fw-bold'>
                            Forms
                        </h3>
                        <div class='ms-auto btn-list'>
                            <TablerIconButton
                                title='Refresh Forms'
                                @click.stop='listForms'
                            >
                                <IconRefresh
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>

                    <div class='px-3 py-2'>
                        <!-- The dropdown autocloses on any click it sees - the
                             search field has to swallow its own -->
                        <TablerInput
                            v-model='search'
                            placeholder='Search...'
                            icon='search'
                            :autofocus='true'
                            class='mb-0'
                            @click.stop
                        />
                    </div>

                    <div class='px-2 pb-2 overflow-auto form-attach-list'>
                        <TablerLoading
                            v-if='loading'
                            :compact='true'
                            desc='Loading Forms'
                        />
                        <TablerAlert
                            v-else-if='error'
                            :err='error'
                        />
                        <template v-else>
                            <div
                                v-for='form of filtered'
                                :key='form.id'
                                class='col-12 py-1 px-2 cloudtak-hover cursor-pointer user-select-none d-flex align-items-center gap-2'
                                @click='add(form)'
                            >
                                <IconPlus
                                    :size='20'
                                    stroke='1.5'
                                    class='flex-shrink-0'
                                />
                                <div style='min-width: 0;'>
                                    <div
                                        class='text-truncate'
                                        v-text='form.name'
                                    />
                                    <div
                                        v-if='form.description'
                                        class='small text-secondary text-truncate'
                                        v-text='form.description'
                                    />
                                </div>
                            </div>
                            <TablerNone
                                v-if='!filtered.length'
                                :compact='true'
                                :create='false'
                                :label='forms.length ? "No Matching Forms" : "No Forms shared with this Channel"'
                            />
                        </template>
                    </div>
                </div>
            </template>
        </TablerDropdown>
    </div>
</template>

<script setup lang='ts'>
/**
 * FormSelect - picker that attaches Core Forms to something (currently Board
 * Columns), each marked required or optional. Selection is staged through
 * `modelValue` so the parent decides when the attachments are persisted;
 * the available Forms are those shared with the given TAK Channel.
 */

import { ref, computed, watch } from 'vue';
import { server } from '../../../std.ts';
import type { CoreForm } from '../../../types.ts';
import { useTriggerWidth } from '../../../utils/trigger-width.ts';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconForms,
    IconTrash,
    IconRefresh,
} from '@tabler/icons-vue';

export type FormAttachment = {
    form: CoreForm;
    required: boolean;
};

const props = withDefaults(defineProps<{
    /** Forms currently attached along with their required flag */
    modelValue: Array<FormAttachment>;
    /** TAK Channel bitpos the Forms must be shared with */
    channel?: number;
    disabled?: boolean;
}>(), {
    channel: undefined,
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: Array<FormAttachment>): void;
    (e: 'error', error: Error): void;
}>();

const search = ref('');
const loading = ref(false);
const error = ref<Error | undefined>();
const forms = ref<Array<CoreForm>>([]);

const trigger = ref<HTMLElement | undefined>();
const { width: menuWidth } = useTriggerWidth(trigger);

const filtered = computed<Array<CoreForm>>(() => {
    const attached = new Set(props.modelValue.map((attachment) => attachment.form.id));
    const term = search.value.trim().toLowerCase();

    return forms.value.filter((form) => {
        if (attached.has(form.id)) return false;

        if (!term) return true;

        return form.name.toLowerCase().includes(term)
            || form.description.toLowerCase().includes(term);
    });
});

watch(() => props.channel, async () => {
    await listForms();
}, { immediate: true });

async function listForms(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/core/form', {
            params: {
                query: {
                    limit: 100,
                    page: 0,
                    order: 'asc',
                    sort: 'name',
                    filter: '',
                    ...(props.channel === undefined ? {} : { channel: props.channel }),
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        forms.value = res.data.items;
    } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err));

        forms.value = [];
        error.value = wrapped;
        emit('error', wrapped);
    }

    loading.value = false;
}

function add(form: CoreForm): void {
    if (props.disabled) return;

    emit('update:modelValue', [
        ...props.modelValue,
        { form, required: false },
    ]);
}

function setRequired(attachment: FormAttachment, required: boolean): void {
    if (props.disabled) return;

    emit('update:modelValue', props.modelValue.map((existing) => {
        return existing.form.id === attachment.form.id
            ? { ...existing, required }
            : existing;
    }));
}

function remove(attachment: FormAttachment): void {
    if (props.disabled) return;

    emit('update:modelValue', props.modelValue.filter((existing) => {
        return existing.form.id !== attachment.form.id;
    }));
}

defineExpose({ refresh: listForms });
</script>

<style>
.form-attach-select .form-attach-row + .form-attach-row {
    border-top: var(--tblr-border-width) solid var(--tblr-border-color);
}

/* The trigger borrows `form-select` so it lines up with the controls beside it -
   that class also draws the caret */
.form-attach-select .form-attach-trigger {
    min-width: 0;
}

.form-attach-menu .form-attach-list {
    max-height: 300px;
}
</style>
