<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-blue' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-body'>
            <div class='modal-title d-flex align-items-center gap-2'>
                <IconForms
                    :size='24'
                    stroke='1.5'
                />
                Complete Required Forms
            </div>
            <div
                v-if='props.forms.length > 1'
                class='ms-auto text-secondary'
                v-text='`Form ${step + 1} of ${props.forms.length}`'
            />
        </div>
        <div class='modal-body text-body'>
            <div class='mb-3'>
                <div
                    class='fw-bold'
                    v-text='current.name'
                />
                <div
                    v-if='current.description'
                    class='text-secondary'
                    v-text='current.description'
                />
                <div
                    v-if='props.eventName'
                    class='form-hint mt-1'
                >
                    Submitted for <span v-text='props.eventName' />
                </div>
            </div>

            <div
                v-if='props.forms.length > 1'
                class='progress mb-3 form-wizard-progress'
            >
                <div
                    class='progress-bar'
                    role='progressbar'
                    :style='{ width: `${(step / props.forms.length) * 100}%` }'
                />
            </div>

            <TablerSchema
                :key='current.id'
                v-model='data'
                :schema='currentSchema'
                :disabled='submitting'
            />

            <TablerAlert
                v-if='error'
                :err='error'
            />

            <div class='d-flex mt-3'>
                <button
                    class='btn btn-secondary'
                    :disabled='submitting'
                    @click='emit("close")'
                >
                    Cancel
                </button>
                <button
                    class='btn btn-primary ms-auto'
                    :disabled='submitting'
                    @click='submit'
                >
                    <TablerLoading
                        v-if='submitting'
                        :compact='true'
                        desc=''
                    />
                    <span
                        v-else
                        v-text='step + 1 < props.forms.length ? "Submit & Continue" : "Submit"'
                    />
                </button>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
/**
 * FormWizard - modal that walks through submitting one Response per Form for
 * a Core Event, linking each Response to the Event as it goes. Used wherever
 * placing an Event into a Board Column is blocked on required Forms: the
 * board's drag & drop flow and Event nomination from both the board and the
 * map side. Forms already submitted before a Cancel stay submitted - re-opening
 * the wizard resumes with the still missing Forms.
 */

import { ref, computed } from 'vue';
import { server } from '../../../std.ts';
import type { CoreForm } from '../../../types.ts';
import { IconForms } from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerModal,
    TablerSchema,
    TablerLoading,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    /** Core Event each Response is linked to */
    eventId: string;
    /** Shown so the user knows what they are submitting against */
    eventName?: string;
    /** Forms to submit, one wizard step each */
    forms: Array<CoreForm>;
}>();

const emit = defineEmits<{
    /** Every Form was submitted */
    (e: 'complete'): void;
    (e: 'close'): void;
}>();

const step = ref(0);
const data = ref<Record<string, unknown>>({});
const submitting = ref(false);
const error = ref<Error | undefined>();

const current = computed<CoreForm>(() => props.forms[step.value]);

/** TablerSchema iterates `properties` - normalise so a bare schema can't crash it */
const currentSchema = computed<Record<string, unknown>>(() => {
    return {
        type: 'object',
        properties: {},
        ...current.value.schema,
    };
});

async function submit(): Promise<void> {
    submitting.value = true;
    error.value = undefined;

    try {
        const res = await server.POST('/api/core/form/{:form}/response', {
            params: { path: { ':form': current.value.id } },
            body: {
                response: data.value,
                events: [props.eventId],
            }
        });

        if (res.error) throw new Error(res.error.message);

        if (step.value + 1 < props.forms.length) {
            step.value += 1;
            data.value = {};
        } else {
            emit('complete');
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    submitting.value = false;
}
</script>

<style>
.form-wizard-progress {
    height: 6px;
}
</style>
