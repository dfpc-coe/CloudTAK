<template>
    <div :class='compact ? "d-inline-flex" : "row"'>
        <TablerIconButton
            v-if='compact'
            :title='selected ? `Icon: ${selectedDisplayName}` : "Select Icon"'
            :disabled='disabled'
            @click='modal = true'
        >
            <img
                v-if='selected'
                :src='selectedUrl'
                style='width: 24px; height: 24px; object-fit: contain;'
            >
            <IconPhotoSearch
                v-else
                :size='24'
                stroke='1'
            />
        </TablerIconButton>
        <div
            v-if='!compact'
            class='col-12 d-flex my-1'
        >
            <span
                v-if='description'
                class='align-self-center'
            >
                <IconInfoSquare
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='help = true'
                />
                <TablerHelp
                    v-if='help'
                    :label='label'
                    :description='description'
                    @click='help = false'
                />
            </span>
            <div
                class='align-self-center subheader'
                :class='{ "required": required }'
                v-text='label'
            />
            <div class='ms-auto align-self-center'>
                <slot />
            </div>
        </div>

        <TablerLoading
            v-if='!compact && loading.sets'
            desc='Loading Iconsets'
        />
        <TablerNone
            v-else-if='!compact && sets.length === 0'
            label='No Iconsets Loaded'
            :compact='true'
            :create='false'
        />
        <template v-else-if='!compact'>
            <TablerInlineAlert
                v-if='err'
                severity='danger'
                title='Icon Not Found'
                :description='err.message'
            />
            <div class='d-flex align-items-center'>
                <template v-if='selected'>
                    <div class='d-flex align-items-center'>
                        <div>
                            <img
                                :src='selectedUrl'
                                class='img-thumbnail'
                                style='width: 25px; height: auto; margin-right: 5px;'
                            >
                        </div>
                        <div
                            class='mx-2'
                            v-text='selectedDisplayName'
                        />
                    </div>
                </template>
                <template v-else>
                    <span class='text-center my-2 mx-2'>No Icon Selected</span>
                </template>

                <div
                    v-if='!disabled'
                    class='ms-auto d-flex align-items-center'
                >
                    <TablerIconButton
                        v-if='selected'
                        title='Remove Icon'
                        @click='removeIcon'
                    >
                        <IconTrash
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        title='Select Icon'
                        @click='modal = true'
                    >
                        <IconPhotoSearch
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>
        </template>

        <TablerModal
            v-if='modal'
            size='xl'
            @close='modal = false'
        >
            <div class='modal-status bg-blue' />
            <div class='modal-body'>
                <div class='d-flex align-items-center justify-content-between mb-3'>
                    <h3 class='modal-title'>
                        Select Icon
                    </h3>
                    <button
                        v-if='compact && selected'
                        type='button'
                        class='btn btn-sm ms-auto me-3'
                        @click='removeIcon(); modal = false'
                    >
                        No Icon
                    </button>
                    <button
                        type='button'
                        class='btn-close'
                        @click='modal = false'
                    />
                </div>
                <div class='row g-2'>
                    <div class='col-12'>
                        <TablerEnum
                            :model-value='setName'
                            :options='setNames'
                            @update:model-value='selectSet($event)'
                            @click.stop
                        />
                    </div>
                    <div class='col-12'>
                        <TablerInput
                            v-model='filter'
                            placeholder='Icon Search'
                            :icon='IconSearch'
                            @click.stop
                        />
                    </div>
                    <div class='col-12'>
                        <TablerToggle
                            v-model='params.showNames'
                            label='Show Icon Names'
                            :off-value='false'
                            :on-value='true'
                        />
                    </div>
                </div>
                <TablerLoading
                    v-if='loading.icons'
                    desc='Loading Icons'
                />
                <div
                    v-else
                    class='row mt-2'
                    :class='{ "g-2": params.showNames }'
                    style='max-height: 60vh; overflow-y: auto;'
                >
                    <div
                        v-for='icon of filteredIcons'
                        :key='icon.name'
                        class='col-6 col-md-4 col-lg-3 col-xl-2 cursor-pointer'
                        :class='{ "text-center": params.showNames }'
                        @click='selectIcon(icon); modal = false'
                    >
                        <div class='card'>
                            <div
                                class='card-body text-center p-1'
                                :class='{ "py-2": params.showNames }'
                            >
                                <img
                                    :src='iconUrls.get(icon.name)'
                                    class='img-thumbnail'
                                    :style='params.showNames ? "width: 64px; height: 64px;" : "width: 40px; height: 40px;"'
                                >
                                <div
                                    v-if='params.showNames'
                                    class='mt-1'
                                    style='font-size: 0.85rem;'
                                    v-text='icon.path'
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </TablerModal>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import Icon from '../../../base/icon.ts';
import { useIconsetIcons } from '../../../utils/iconset-icons.ts';
import type { DBIcon } from '../../../database.ts';
import {
    IconInfoSquare,
    IconTrash,
    IconPhotoSearch,
    IconSearch
} from '@tabler/icons-vue';
import {
    TablerInlineAlert,
    TablerHelp,
    TablerEnum,
    TablerNone,
    TablerInput,
    TablerModal,
    TablerLoading,
    TablerToggle,
    TablerIconButton
} from '@tak-ps/vue-tabler';

interface Props {
    modelValue: string;
    description?: string;
    required?: boolean;
    disabled?: boolean;
    label?: string;
    /** Render only a small button that opens the picker */
    compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    description: '',
    required: false,
    disabled: false,
    label: 'Icon Select',
    compact: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const help = ref(false);
const err = ref<Error | null>(null);

const modal = ref(false);
const params = ref({
    showNames: false,
});

const {
    loading, sets, setName, setNames, filter, filtered: filteredIcons, urls: iconUrls, load, selectSet
} = useIconsetIcons();

const selected = ref<DBIcon | null>(null);
const selectedUrl = ref<string>('');

const selectedDisplayName = computed<string>(() => {
    if (!selected.value) return '';
    return Icon.leaf(selected.value.path);
});

watch(() => props.modelValue, async () => {
    await fetchSelected();
});

onMounted(async () => {
    await load();
    await fetchSelected();
});

onUnmounted(revokeSelectedUrl);

function revokeSelectedUrl(): void {
    if (selectedUrl.value) {
        URL.revokeObjectURL(selectedUrl.value);
        selectedUrl.value = '';
    }
}

function selectIcon(icon: DBIcon): void {
    revokeSelectedUrl();
    selected.value = icon;
    selectedUrl.value = URL.createObjectURL(icon.data);
    err.value = null;
    emit('update:modelValue', icon.name);
}

function removeIcon(): void {
    revokeSelectedUrl();
    selected.value = null;
    emit('update:modelValue', '');
}

async function fetchSelected(): Promise<void> {
    if (
        !props.modelValue
        || props.modelValue.startsWith('2525')
        || (
            !props.modelValue.includes(':')
            && props.modelValue.split('/').length < 3
        )
    ) {
        return;
    }

    const icon = await Icon.get(Icon.key(props.modelValue));
    if (!icon) {
        err.value = new Error(`Icon not found: ${props.modelValue}`);
        return;
    }

    err.value = null;
    revokeSelectedUrl();
    selected.value = icon;
    selectedUrl.value = URL.createObjectURL(icon.data);
}
</script>
