<template>
    <div class='col-12'>
        <template v-if='props.disabled'>
            <div
                v-for='item in props.items'
                :key='item.id'
            >
                <slot
                    name='item'
                    :item='item'
                />
            </div>
        </template>
        <template v-else>
            <div
                class='col-12 d-flex py-2 btn-list border-bottom'
            >
                <TablerIconButton
                    v-if='selected.size < props.items.length'
                    title='Select All'
                    @click='props.items.forEach(item => selected.add(item.id))'
                >
                    <IconSelectAll
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    v-if='selected.size > 0'
                    title='Deselect All'
                    @click='selected.clear()'
                >
                    <IconDeselect
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <div
                    class='ms-auto me-2'
                >
                    <slot
                        name='buttons'
                        :disabled='selected.size === 0'
                    />
                </div>
            </div>

            <template
                v-for='item in props.items'
                :key='item.id'
            >
                <div
                    class='d-flex align-items-center hover rounded cursor-pointer'
                    @click='selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id)'
                >
                    <div
                        class='mx-2'
                    >
                        <IconCircleFilled
                            v-if='selected.has(item.id)'
                            :size='24'
                            stroke='1'
                        />
                        <IconCircle
                            v-else
                            :size='24'
                            stroke='1'
                        />
                    </div>

                    <slot
                        name='item'
                        :item='item'
                    />
                </div>
            </template>
        </template>
    </div>
</template>

<script setup lang='ts' generic='T extends SelectableItem'>
import { ref } from 'vue';
import {
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconCircleFilled,
    IconSelectAll,
    IconDeselect,
    IconCircle
} from '@tabler/icons-vue';

export interface SelectableItem {
    id: number | string;
}

defineSlots<{
    item: { item: T };
    buttons: { disabled: boolean };
}>();

const props = withDefaults(defineProps<{
    disabled?: boolean
    items: T[]
}>(), {
    disabled: false
})

const selected = ref<Set<string | number>>(new Set());

interface GenericSelectExpose {
  selected: Set<string | number>;
}

defineExpose<GenericSelectExpose>({
    selected: selected.value
});
</script>
