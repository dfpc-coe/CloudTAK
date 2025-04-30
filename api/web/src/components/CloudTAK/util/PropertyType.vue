<template>
    <div class='col-12'>
        <div class='mx-2'>
            <TablerDropdown>
                <div
                    class='bg-gray-500 rounded-top py-2 px-2 text-truncate d-flex'
                    :class='{
                        "hover-button hover-border cursor-pointer": hover,
                  }'
                >
                    <FeatureIcon
                        :feature='{ properties: { type } }'
                    />

                    <div class='mx-2' v-text='type'/>
                </div>

                <template #dropdown>
                    <div
                        class='rounded border border-white px-2 py-2'
                        style='width: 384px;'
                    >
                        <TablerInput
                            :autofocus='true'
                            v-model='paging.filter'
                        />

                        <template v-for='item of list.items'>
                            <div
                                @click='type = item.cot'
                                class='d-flex px-2 py-2 hover-dark cursor-pointer rounded'
                            >
                                <FeatureIcon
                                    :feature='{ properties: { icon: item.cot.replace(/^a-\.-/, "a-u-") } }'
                                />

                                <div class='mx-2' v-text='item.full'/>
                            </div>
                        </template>
                    </div>
            </template>
            </TablerDropdown>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import FeatureIcon from './FeatureIcon.vue';
import {
    TablerInput,
    TablerDropdown
} from '@tak-ps/vue-tabler';

const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    hover: {
        type: Boolean,
        default: true
    }
})

const emit = defineEmits(['update:modelValue']);

const mode = ref(props.modelValue.split('-')[1])
const type = ref(props.modelValue);
const loading = ref(true);

const paging = ref({
    filter: ''
})

const list = ref({
    total: 0,
    items: []
});

watch(props.modelValue, () => {
    console.error('PROP CHANGE');
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;

    const url = stdurl('/api/type/cot');
    url.searchParams.append('filter', paging.value.filter);

    list.value = await std(url);
}

</script>
