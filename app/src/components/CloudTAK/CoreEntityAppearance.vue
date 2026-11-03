<template>
    <MenuTemplate
        name='Appearance'
        :loading='loading'
        :none='!loading && !entity'
    >
        <div
            v-if='entity && draft'
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

            <TablerAlert
                v-if='saveError'
                :err='saveError'
            />

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
                :spot='false'
                @update:marker='setMarker($event)'
                @update:icon='draft.icon = $event'
                @update:color='draft.color = $event'
                @update:opacity='draft.opacity = $event'
            />

            <TablerInlineAlert
                v-if='needsIcon'
                class='mt-3'
                severity='info'
                title='Choose an icon'
                description='The military symbol stays on the map until an icon is picked.'
            />
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TablerAlert, TablerInlineAlert } from '@tak-ps/vue-tabler';
import MenuTemplate from './util/MenuTemplate.vue';
import FeatureIcon from './util/FeatureIcon.vue';
import AppearanceAffiliation from './Appearance/AppearanceAffiliation.vue';
import AppearanceTypeSelect from './Appearance/AppearanceTypeSelect.vue';
import AppearanceSymbolDetails from './Appearance/AppearanceSymbolDetails.vue';
import AppearanceMarker from './Appearance/AppearanceMarker.vue';
import { iconsetIconLabel } from './Appearance/icon-label.ts';
import Type2525 from '@tak-ps/node-cot/2525';
import COT, { renderedIconImage } from '../../base/cot.ts';
import { server } from '../../std.ts';
import { useMapStore } from '../../stores/map.ts';
import { useEntityAccess } from '../../utils/entity-access.ts';
import { entityAppearance, entityStyleFrom, entityMarkerProperties } from '../../utils/core-entity.ts';
import type { CoreEntityKind } from '../../utils/core-entity.ts';
import type { CoreEntity, CoreDevice, Feature } from '../../types.ts';
import {
    draftFrom,
    applyAppearance,
    describeAppearance,
    withAffiliation,
    withContext,
    contextOf,
    carryFrame,
    isIconsetIcon,
} from '../../utils/appearance.ts';
import type { AppearanceDraft, Marker } from '../../utils/appearance.ts';

type Entity = CoreEntity | CoreDevice;

const props = defineProps<{
    kind: CoreEntityKind;
}>();

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

const loading = ref(true);
const entity = ref<Entity | undefined>();
const draft = ref<AppearanceDraft | undefined>();
const saveError = ref<Error | undefined>();

const typeName = ref<string | undefined>();
const iconName = ref<string | undefined>();

const { is_editable, load: loadAccess } = useEntityAccess(entity);

const id = computed<string>(() => String(route.params[props.kind]));

const draftContext = computed<string | undefined>(() => {
    const type = draft.value?.type;
    return type && Type2525.isNumericSIDCConvertable(type) ? contextOf(type) : undefined;
});

const preview = computed<Feature['properties']>(() => {
    if (!entity.value) return {} as Feature['properties'];

    const current = entityAppearance(entity.value);
    return draft.value ? applyAppearance(current, draft.value) : current;
});

const previewKey = computed<string>(() => {
    return renderedIconImage(preview.value) || preview.value.type || '';
});

const summary = computed(() => {
    if (!entity.value) return { title: '', subtitle: '' };
    return describeAppearance(preview.value, typeName.value, iconName.value);
});

const needsIcon = computed<boolean>(() => {
    return !!draft.value && draft.value.marker === 'icon' && !isIconsetIcon(draft.value.icon);
});

let persistTimeout: ReturnType<typeof setTimeout> | undefined;

watch(preview, (properties) => {
    if (!entity.value) return;

    const next = entityStyleFrom(properties);
    const current = entityStyleFrom(entityAppearance(entity.value));
    if (JSON.stringify(next) === JSON.stringify(current)) return;

    if (persistTimeout) clearTimeout(persistTimeout);
    persistTimeout = setTimeout(() => void persist(next), 100);
});

onUnmounted(() => {
    if (persistTimeout) clearTimeout(persistTimeout);
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

async function fetch(): Promise<Entity> {
    if (props.kind === 'event') {
        const res = await server.GET('/api/core/event/{:event}', {
            params: { path: { ':event': id.value } }
        });

        if (res.error) throw new Error(res.error.message);
        return res.data as CoreEntity;
    }

    const res = await server.GET('/api/core/device/{:device}', {
        params: { path: { ':device': id.value } }
    });

    if (res.error) throw new Error(res.error.message);
    return res.data as CoreDevice;
}

async function load(): Promise<void> {
    loading.value = true;

    try {
        await loadAccess();
        entity.value = await fetch();

        if (!is_editable.value) {
            await back();
            return;
        }

        draft.value = draftFrom(entityAppearance(entity.value));
    } catch (err) {
        saveError.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

function setAffiliation(code: string): void {
    if (!draft.value) return;

    draft.value.affiliation = code;
    if (draft.value.type) draft.value.type = withAffiliation(draft.value.type, code);
}

function setMarker(marker: Marker): void {
    if (!draft.value) return;

    draft.value.marker = marker;
    if (marker !== 'icon') draft.value.icon = undefined;
}

function setContext(context: string): void {
    if (!draft.value || !draft.value.type) return;
    draft.value.type = withContext(draft.value.type, context);
}

function setType(type: string): void {
    if (!draft.value) return;
    draft.value.type = carryFrame(draft.value.type, type);
}

async function persist(body: ReturnType<typeof entityStyleFrom>): Promise<void> {
    if (!entity.value) return;

    saveError.value = undefined;

    try {
        if (props.kind === 'event') {
            const res = await server.PATCH('/api/core/event/{:event}', {
                params: { path: { ':event': entity.value.id } },
                body
            });

            if (res.error) throw new Error(res.error.message);
            entity.value = res.data as CoreEntity;
        } else {
            const res = await server.PATCH('/api/core/device/{:device}', {
                params: { path: { ':device': entity.value.id } },
                body
            });

            if (res.error) throw new Error(res.error.message);
            entity.value = res.data as CoreDevice;
        }

        await syncMapFeature();
    } catch (err) {
        saveError.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function syncMapFeature(): Promise<void> {
    if (!entity.value || !mapStore._worker) return;

    try {
        const cot = await mapStore.worker.db.get(entity.value.id);
        if (!cot) return;

        await cot.update({ properties: entityMarkerProperties(cot.properties, entity.value) });
    } catch (err) {
        console.error(`Failed to sync ${props.kind} ${entity.value.id} to its map feature:`, err);
    }
}

async function back(): Promise<void> {
    const previous = router.options.history.state.back;

    if (previous && String(previous).startsWith(`/${props.kind}/`)) {
        router.back();
    } else {
        await router.replace(`/${props.kind}/${id.value}`);
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
