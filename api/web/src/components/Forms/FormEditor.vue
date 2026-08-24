<template>
    <div>
        <TablerLoading
            v-if='loading'
            desc='Loading Form'
        />
        <template v-else>
            <div class='row g-2'>
                <div class='col-12'>
                    <TablerInput
                        v-model='config.name'
                        label='Name'
                        :required='true'
                    />
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='config.description'
                        label='Description'
                        :rows='3'
                    />
                </div>
                <div class='col-12'>
                    <label class='form-label'>Share to Channels</label>
                    <div
                        class='overflow-auto'
                        style='max-height: 250px;'
                    >
                        <GroupSelect
                            v-model='config.channels'
                            :active='true'
                        />
                    </div>
                    <div class='form-hint mt-1'>
                        A Form can only be attached to Boards of the Channels it is shared with
                    </div>
                </div>
                <div class='col-12'>
                    <TablerSchemaBuilder
                        v-model='config.schema'
                        title='Form Schema'
                    />
                </div>
            </div>

            <TablerAlert
                v-if='error'
                :err='error'
            />

            <div class='d-flex mt-3'>
                <button
                    class='btn btn-secondary'
                    :disabled='saving'
                    @click='emit("cancel")'
                >
                    Cancel
                </button>
                <button
                    class='btn btn-primary ms-auto'
                    :disabled='saving || !config.name.trim()'
                    @click='save'
                >
                    <TablerLoading
                        v-if='saving'
                        :compact='true'
                        desc=''
                    />
                    <span
                        v-else
                        v-text='props.form ? "Save Form" : "Create Form"'
                    />
                </button>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
/**
 * FormEditor - create or edit a single Core Form: name, description, the
 * Channels it is shared with, and its JSON Schema built with the same
 * TablerSchemaBuilder the Mission Template Log Forms use. Channel selection
 * works on names (GroupSelect's contract) and is mapped to bitpos on save.
 */

import { ref, onMounted } from 'vue';
import { server } from '../../std.ts';
import type { CoreForm } from '../../types.ts';
import GroupSelect from '../util/GroupSelect.vue';
import GroupManager from '../../base/group.ts';
import {
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerSchemaBuilder,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    /** Form to edit - omit to create a new Form */
    form?: CoreForm;
    /** TAK Channel bitpos preselected for sharing on a new Form */
    channel?: number;
}>();

const emit = defineEmits<{
    (e: 'saved', form: CoreForm): void;
    (e: 'cancel'): void;
}>();

const loading = ref(true);
const saving = ref(false);
const error = ref<Error | undefined>();

const config = ref({
    name: props.form?.name || '',
    description: props.form?.description || '',
    channels: [] as Array<string>,
    schema: (props.form ? { ...props.form.schema } : {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
    }) as Record<string, unknown>,
});

onMounted(async () => {
    try {
        const groups = await GroupManager.list();

        if (props.form) {
            const shared = new Set(props.form.channels);
            config.value.channels = groups
                .filter((group) => shared.has(group.bitpos))
                .map((group) => group.name);
        } else if (props.channel !== undefined) {
            const match = groups.find((group) => group.bitpos === props.channel);
            if (match) config.value.channels = [match.name];
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
});

async function save(): Promise<void> {
    if (!config.value.name.trim()) return;

    saving.value = true;
    error.value = undefined;

    try {
        const groups = await GroupManager.list();
        const channels = groups
            .filter((group) => config.value.channels.includes(group.name))
            .map((group) => group.bitpos);

        const body = {
            name: config.value.name.trim(),
            description: config.value.description,
            schema: config.value.schema,
            channels,
        };

        const res = props.form
            ? await server.PATCH('/api/core/form/{:form}', {
                params: { path: { ':form': props.form.id } },
                body,
            })
            : await server.POST('/api/core/form', { body });

        if (res.error) throw new Error(res.error.message);

        emit('saved', res.data);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    saving.value = false;
}
</script>
