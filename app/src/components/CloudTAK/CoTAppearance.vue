<template>
    <MenuTemplate
        name='Appearance'
        :loading='loading'
        :none='!loading && !cot'
    >
        <template #buttons>
            <TablerButton
                v-if='cot'
                class='btn-primary btn-sm'
                :disabled='!canSave || saving'
                @click='save'
            >
                Done
            </TablerButton>
        </template>

        <div
            v-if='cot && isPoint && draft'
            class='pb-3'
        >
            <div class='d-flex align-items-center py-3'>
                <div class='preview rounded d-flex align-items-center justify-content-center flex-shrink-0'>
                    <FeatureIcon
                        :key='previewKey'
                        :size='40'
                        :feature='{ properties: preview }'
                    />
                </div>
                <div
                    class='flex-grow-1 ms-3'
                    style='min-width: 0;'
                >
                    <div
                        class='fw-bold text-truncate'
                        v-text='summary.title'
                    />
                    <div
                        class='text-secondary small text-truncate'
                        v-text='summary.subtitle'
                    />
                </div>
            </div>

            <div class='fw-bold pb-2'>
                What it is
            </div>

            <AppearanceAffiliation
                :model-value='draft.affiliation'
                :context='draftContext'
                @update:model-value='setAffiliation($event)'
                @update:context='setContext($event)'
            />

            <AppearanceTypeSelect
                class='pt-3'
                :model-value='draft.type'
                :affiliation='draft.affiliation'
                @update:model-value='setType($event)'
            />

            <AppearanceSymbolDetails
                v-if='draft.type'
                class='mt-2'
                :model-value='draft.type'
                @update:model-value='draft.type = $event'
            />

            <div class='fw-bold pt-4 pb-2'>
                How it looks
            </div>

            <AppearanceMarker
                :marker='draft.marker'
                :icon='draft.icon'
                :color='draft.color'
                :opacity='draft.opacity'
                @update:marker='draft.marker = $event'
                @update:icon='draft.icon = $event'
                @update:color='draft.color = $event'
                @update:opacity='draft.opacity = $event'
            />

            <TablerInlineAlert
                v-if='!canSave'
                class='mt-3'
                severity='info'
                title='Choose an icon'
                description='Pick an icon from an Iconset, or switch back to Military symbol or Dot.'
            />
        </div>

        <div
            v-else-if='cot && style'
            class='pb-3'
        >
            <div class='d-flex align-items-center py-3'>
                <div class='preview rounded d-flex align-items-center justify-content-center flex-shrink-0'>
                    <FeatureIcon
                        :key='previewKey'
                        :size='40'
                        :feature='{ properties: preview, geometry: cot.geometry }'
                    />
                </div>
                <div
                    class='flex-grow-1 ms-3'
                    style='min-width: 0;'
                >
                    <div
                        class='fw-bold text-truncate'
                        v-text='summary.title'
                    />
                    <div
                        class='text-secondary small text-truncate'
                        v-text='summary.subtitle'
                    />
                </div>
            </div>

            <div class='fw-bold pb-2'>
                How it looks
            </div>

            <AppearanceStroke
                :model-value='style'
                :fill='hasFill'
                @update:model-value='style = $event'
            />
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    TablerButton,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import MenuTemplate from './util/MenuTemplate.vue';
import FeatureIcon from './util/FeatureIcon.vue';
import AppearanceAffiliation from './Appearance/AppearanceAffiliation.vue';
import AppearanceTypeSelect from './Appearance/AppearanceTypeSelect.vue';
import AppearanceSymbolDetails from './Appearance/AppearanceSymbolDetails.vue';
import AppearanceMarker from './Appearance/AppearanceMarker.vue';
import AppearanceStroke from './Appearance/AppearanceStroke.vue';
import { appearanceSaved } from './Appearance/saved.ts';
import { iconsetIconLabel } from './Appearance/icon-label.ts';
import Type2525 from '@tak-ps/node-cot/2525';
import COT, { OriginMode, renderedIconImage } from '../../base/cot.ts';
import Subscription from '../../base/subscription.ts';
import { useMapStore } from '../../stores/map.ts';
import type { Feature } from '../../types.ts';
import {
    draftFrom,
    applyAppearance,
    describeAppearance,
    styleFrom,
    applyStyle,
    describeStyle,
    withAffiliation,
    withContext,
    contextOf,
    carryFrame,
    isIconsetIcon,
} from '../../utils/appearance.ts';
import type { AppearanceDraft, StyleDraft } from '../../utils/appearance.ts';

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

const loading = ref(true);
const saving = ref(false);
const cot = ref<COT | undefined>();
const draft = ref<AppearanceDraft | undefined>();
const style = ref<StyleDraft | undefined>();

const typeName = ref<string | undefined>();
const iconName = ref<string | undefined>();

const isPoint = computed<boolean>(() => cot.value?.geometry.type === 'Point');

// Only a 2525E symbol has a context digit to edit
const draftContext = computed<string | undefined>(() => {
    const type = draft.value?.type;
    return type && Type2525.isNumericSIDCConvertable(type) ? contextOf(type) : undefined;
});

const hasFill = computed<boolean>(() => {
    const geometry = cot.value?.geometry.type;
    return geometry === 'Polygon' || geometry === 'MultiPolygon';
});

const preview = computed<Feature['properties']>(() => {
    if (!cot.value) return {} as Feature['properties'];

    if (isPoint.value) {
        return draft.value ? applyAppearance(cot.value.properties, draft.value) : cot.value.properties;
    }

    return style.value ? applyStyle(cot.value.properties, cot.value.geometry.type, style.value) : cot.value.properties;
});

const previewKey = computed<string>(() => {
    if (!isPoint.value) return JSON.stringify(style.value || {});
    return renderedIconImage(preview.value) || preview.value.type || '';
});

const summary = computed(() => {
    if (!cot.value) return { title: '', subtitle: '' };
    if (!isPoint.value) return describeStyle(cot.value.geometry.type, preview.value);
    return describeAppearance(preview.value, typeName.value, iconName.value);
});

const canSave = computed<boolean>(() => {
    if (!isPoint.value) return !!style.value;
    return !!draft.value && (draft.value.marker !== 'icon' || isIconsetIcon(draft.value.icon));
});

watch(() => preview.value.type, async (type) => {
    typeName.value = undefined;
    if (!type) return;

    const resolved = await COT.resolveType(type);
    if (type === preview.value.type) typeName.value = resolved.name;
});

watch(() => preview.value.icon, async (icon) => {
    iconName.value = undefined;
    if (!isIconsetIcon(icon)) return;

    const label = await iconsetIconLabel(icon as string);
    if (icon === preview.value.icon) iconName.value = label;
});

onMounted(async () => {
    await load();
});

async function load(): Promise<void> {
    loading.value = true;

    try {
        const uid = String(route.params.uid);
        const loaded = await mapStore.worker.db.get(uid, { mission: true });

        if (!loaded || !loaded.is_editable) {
            await back();
            return;
        }

        if (loaded.origin.mode === OriginMode.MISSION && loaded.origin.mode_id) {
            const subscription = await Subscription.from(loaded.origin.mode_id);

            if (!subscription || !subscription.role || !subscription.role.permissions.includes('MISSION_WRITE')) {
                await back();
                return;
            }
        }

        cot.value = loaded;

        if (loaded.geometry.type === 'Point') {
            draft.value = draftFrom(loaded.properties);
        } else {
            style.value = styleFrom(loaded.properties);
        }
    } finally {
        loading.value = false;
    }
}

function setAffiliation(code: string): void {
    if (!draft.value) return;

    draft.value.affiliation = code;
    if (draft.value.type) draft.value.type = withAffiliation(draft.value.type, code);
}

function setContext(context: string): void {
    if (!draft.value || !draft.value.type) return;
    draft.value.type = withContext(draft.value.type, context);
}

function setType(type: string): void {
    if (!draft.value) return;

    draft.value.type = carryFrame(draft.value.type, type);

    // A custom icon is the user's own pick and survives a type change
    if (draft.value.marker === 'dot') draft.value.marker = 'symbol';
}

async function save(): Promise<void> {
    if (!cot.value || !canSave.value) return;

    saving.value = true;

    try {
        await cot.value.update({ properties: preview.value });
        appearanceSaved.value = cot.value.id;
        await back();
    } finally {
        saving.value = false;
    }
}

async function back(): Promise<void> {
    const previous = router.options.history.state.back;

    if (previous && String(previous).startsWith('/cot/')) {
        router.back();
    } else {
        await router.replace(`/cot/${String(route.params.uid)}`);
    }
}
</script>

<style scoped>
.preview {
    width: 64px;
    height: 64px;
    background: var(--tblr-bg-surface-secondary, rgba(128, 128, 128, 0.12));
}
</style>
