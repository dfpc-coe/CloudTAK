<template>
    <TablerLoading
        v-if='loading'
        :inline='true'
        desc='Loading Channels'
    />
    <TablerAlert
        v-else-if='error'
        title='Channels Error'
        :err='error'
    />
    <GroupSelect
        v-else
        :model-value='names'
        :connection='connection'
        :disabled='disabled'
        @update:model-value='update'
    />
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { server } from '../../../../std.ts';
import { TablerAlert, TablerLoading } from '@tak-ps/vue-tabler';
import GroupSelect from '../../../util/GroupSelect.vue';

const props = withDefaults(defineProps<{
    /** TAK Channel bitpos values */
    modelValue?: number[];
    connection: number;
    disabled?: boolean;
}>(), {
    modelValue: () => [],
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: number[]): void;
}>();

const loading = ref(true);
const error = ref<Error | undefined>();
const names = ref<string[]>([]);
const bitpos = ref<Map<string, number>>(new Map());

// GroupSelect works with Channel names while Core records store the Channel bitpos
onMounted(async () => {
    try {
        const res = await server.GET('/api/marti/group', {
            params: { query: { connection: props.connection, useCache: true } },
        });
        if (res.error) throw new Error(res.error.message);

        for (const group of res.data.data) {
            bitpos.value.set(group.name, group.bitpos);
        }

        names.value = Array.from(bitpos.value.entries())
            .filter(([, pos]) => props.modelValue.includes(pos))
            .map(([name]) => name);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
});

function update(selected: string[]) {
    names.value = selected;

    emit('update:modelValue', selected
        .map((name) => bitpos.value.get(name))
        .filter((pos): pos is number => pos !== undefined));
}
</script>
