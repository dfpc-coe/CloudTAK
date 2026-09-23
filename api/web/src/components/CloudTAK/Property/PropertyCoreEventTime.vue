<template>
    <div class='col-12'>
        <div class='d-flex align-items-center'>
            <IconClock
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
            <label
                class='subheader user-select-none'
                v-text='props.label'
            />
            <div class='ms-auto d-flex align-items-center me-2'>
                <span
                    v-if='props.modelValue'
                    class='mx-2 text-muted cursor-pointer'
                    @click='relative = !relative'
                    v-text='relative ? timediff(props.modelValue) : new Date(props.modelValue).toLocaleString()'
                />
                <span
                    v-else
                    class='mx-2 text-muted'
                    v-text='"Open Ended"'
                />

                <TablerIconButton
                    v-if='props.edit && !editing'
                    :title='`Edit ${props.label}`'
                    @click='open'
                >
                    <IconPencil
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-if='editing'
            class='mx-2 pt-1'
        >
            <TablerInput
                label=''
                type='datetime-local'
                :model-value='draft'
                @update:model-value='draft = String($event || "")'
            />
            <div class='d-flex align-items-center gap-1 pt-2'>
                <template v-if='props.presets'>
                    <button
                        v-for='preset in PRESETS'
                        :key='preset.label'
                        type='button'
                        class='btn btn-sm'
                        :title='`Push ${props.label} out by ${preset.label.slice(1)}`'
                        @click='push(preset.hours)'
                        v-text='preset.label'
                    />
                </template>
                <div class='ms-auto d-flex gap-1'>
                    <button
                        v-if='props.nullable && props.modelValue'
                        type='button'
                        class='btn btn-sm'
                        @click='save(null)'
                    >
                        Clear
                    </button>
                    <button
                        type='button'
                        class='btn btn-sm'
                        @click='editing = false'
                    >
                        Cancel
                    </button>
                    <button
                        type='button'
                        class='btn btn-sm btn-primary'
                        :disabled='!draft'
                        @click='save(new Date(draft).toISOString())'
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { TablerInput, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconClock, IconPencil } from '@tabler/icons-vue';
import timediff from '../../../timediff';

const PRESETS = [
    { label: '+1h', hours: 1 },
    { label: '+4h', hours: 4 },
    { label: '+24h', hours: 24 },
];

const props = withDefaults(defineProps<{
    label: string;
    modelValue: string | null;
    edit?: boolean;
    /** The time may be cleared - an Event without an ended time is open ended */
    nullable?: boolean;
    /** Offer buttons that push the time out from the later of now & its current value */
    presets?: boolean;
}>(), {
    edit: false,
    nullable: false,
    presets: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string | null): void
}>();

const relative = ref(true);
const editing = ref(false);
const draft = ref('');

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** A datetime-local input takes local wall clock time without a zone */
function toLocalInput(time: Date): string {
    return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}T${pad(time.getHours())}:${pad(time.getMinutes())}`;
}

function open(): void {
    draft.value = props.modelValue ? toLocalInput(new Date(props.modelValue)) : '';
    editing.value = true;
}

function push(hours: number): void {
    const from = props.modelValue ? Math.max(Date.now(), new Date(props.modelValue).getTime()) : Date.now();
    draft.value = toLocalInput(new Date(from + hours * 60 * 60 * 1000));
}

function save(value: string | null): void {
    emit('update:modelValue', value);
    editing.value = false;
}
</script>
