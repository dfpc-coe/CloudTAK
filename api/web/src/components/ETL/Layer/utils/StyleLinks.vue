<template>
    <div class='col-12'>
        <div class='col-12 d-flex align-items-center'>
            <label v-text='props.label' />

            <div
                v-if='!props.disabled'
                class='ms-auto btn-list'
            >
                <IconPlus
                    v-tooltip='"Add Link"'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='create = true'
                />
            </div>
        </div>

        <TablerNone
            v-if='!links.length'
            :create='false'
            :compact='true'
            label='No Link Overrides'
        />
        <div
            v-else
            class='table-responsive'
        >
            <table
                class='table card-table table-vcenter'
                :class='{
                    "cursor-pointer": !props.disabled
                }'
            >
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='(link, it) in links'
                        :key='`${link.url}-${link.remarks}`'
                        @click='edit(link)'
                    >
                        <td v-text='link.remarks' />
                        <td>
                            <div class='d-flex align-items-center'>
                                <span v-text='link.url' />
                                <div class='ms-auto'>
                                    <IconTrash
                                        v-if='!props.disabled'
                                        :size='32'
                                        stroke='1'
                                        class='cursor-pointer'
                                        @click.stop='links.splice(it, 1)'
                                    />
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <StyleLinkModal
        v-if='create'
        :edit='editLink'
        :schema='props.schema'
        @done='push($event)'
        @close='create = false'
    />
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import {
    TablerNone
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconTrash
} from '@tabler/icons-vue';
import StyleLinkModal from './StyleLinkModal.vue';

interface StyleLink {
    remarks: string;
    url: string;
    [key: string]: unknown;
}

const props = withDefaults(defineProps<{
    modelValue: StyleLink[];
    disabled?: boolean;
    schema: Record<string, unknown>;
    label?: string;
}>(), {
    disabled: true,
    label: 'Link Override',
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: StyleLink[]): void;
}>();

const create = ref(false);
const editLink = ref<StyleLink | undefined>();
const links = ref<StyleLink[]>(props.modelValue);

watch(() => props.modelValue, () => {
    links.value = props.modelValue;
}, {
    deep: true
});

function edit(link: StyleLink) {
    if (props.disabled) return;
    editLink.value = link;
    create.value = true;
}

function push(link: StyleLink) {
    create.value = false;

    if (!editLink.value) {
        links.value.push(link);
    } else {
        Object.assign(editLink.value, link);
    }

    emit('update:modelValue', links.value);

    editLink.value = undefined;
}
</script>
