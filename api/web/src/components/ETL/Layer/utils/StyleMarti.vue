<template>
    <div class='col-12'>
        <div class='col-12 d-flex align-items-center py-2'>
            <label class='user-select-none subheader'>
                <IconArchive :size='20' stroke='1' /> Archive CoT
            </label>
            <div class='ms-auto'>
                <div
                    class='btn-group btn-group-sm'
                    role='group'
                >
                    <button
                        type='button'
                        class='btn'
                        :class='marti.archive === undefined ? "btn-secondary" : "btn-outline-secondary"'
                        :disabled='props.disabled'
                        @click='marti.archive = undefined'
                    >Default</button>
                    <button
                        type='button'
                        class='btn'
                        :class='marti.archive === true ? "btn-secondary" : "btn-outline-secondary"'
                        :disabled='props.disabled'
                        @click='marti.archive = true'
                    >On</button>
                    <button
                        type='button'
                        class='btn'
                        :class='marti.archive === false ? "btn-secondary" : "btn-outline-secondary"'
                        :disabled='props.disabled'
                        @click='marti.archive = false'
                    >Off</button>
                </div>
            </div>
        </div>

        <div class='col-12 d-flex align-items-center py-2'>
            <label class='user-select-none subheader'>
                <IconSend :size='20' stroke='1' /> Routing Destinations
            </label>
            <div
                v-if='!props.disabled'
                class='ms-auto btn-list'
            >
                <IconPlus
                    v-tooltip='"Add Destination"'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='addDest'
                />
            </div>
        </div>

        <TablerNone
            v-if='!dests.length'
            :create='false'
            :compact='true'
            label='No Routing Destinations'
        />
        <div
            v-for='(dest, it) in dests'
            :key='it'
            class='d-flex align-items-start gap-2 mb-2'
        >
            <div style='width: 140px; flex-shrink: 0;'>
                <TablerEnum
                    v-model='dest.type'
                    :disabled='props.disabled'
                    :options='["group", "mission", "uid", "callsign"]'
                    @update:model-value='format'
                />
            </div>
            <div class='flex-grow-1'>
                <GroupSelect
                    v-if='dest.type === "group"'
                    :model-value='dest.value ? [dest.value] : []'
                    :limit='1'
                    :disabled='props.disabled'
                    @update:model-value='dest.value = $event[0] ?? ""; format()'
                />
                <TablerInput
                    v-else
                    v-model='dest.value'
                    placeholder='Value'
                    :disabled='props.disabled'
                    @update:model-value='format'
                />
            </div>
            <IconTrash
                v-if='!props.disabled'
                :size='20'
                stroke='1'
                class='cursor-pointer mt-2'
                @click='removeDest(it)'
            />
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import {
    TablerInput,
    TablerEnum,
    TablerNone
} from '@tak-ps/vue-tabler';
import {
    IconArchive,
    IconSend,
    IconPlus,
    IconTrash
} from '@tabler/icons-vue';
import GroupSelect from '../../../util/GroupSelect.vue';

const props = defineProps({
    modelValue: {
        type: Object,
        default: function() {
            return {};
        }
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue']);

/** Internal flat representation: { type: 'group' | 'mission' | 'uid' | 'callsign', value: string } */
const dests = ref([]);

const marti = ref({
    archive: undefined
});

watch(marti, format, { deep: true });

onMounted(() => {
    marti.value.archive = props.modelValue.archive;

    if (Array.isArray(props.modelValue.dest)) {
        dests.value = props.modelValue.dest.map((d) => {
            const type = ['group', 'mission', 'uid', 'callsign'].find((k) => d[k] !== undefined) || 'group';
            return { type, value: d[type] || '' };
        });
    }
});

function addDest() {
    dests.value.push({ type: 'group', value: '' });
    format();
}

function removeDest(index) {
    dests.value.splice(index, 1);
    format();
}

function format() {
    const result = {};

    if (marti.value.archive !== undefined) {
        result.archive = marti.value.archive;
    }

    const dest = dests.value
        .filter((d) => d.value)
        .map((d) => ({ [d.type]: d.value }));

    if (dest.length) {
        result.dest = dest;
    }

    emit('update:modelValue', result);
}
</script>
