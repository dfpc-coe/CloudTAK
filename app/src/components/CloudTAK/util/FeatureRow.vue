<template>
    <div
        v-if='!isDeleted'
        class='w-100'
    >
        <StandardItem
            class='feature-row w-100 d-flex flex-row gap-3 mb-2 align-items-center px-2 py-2'
            :class='{
                "cursor-pointer": isZoomable && props.hover,
                "cursor-default": !isZoomable || props.hover === false,
                "cloudtak-hover-fill": hover
            }'
            :hover='hover'
            @click='(e: MouseEvent) => { if (e.ctrlKey) selectClick(); else flyToClick(); }'
        >
            <div
                v-if='props.gripHandle'
                :id='feature.id'
                class='d-flex drag-handle cursor-grab align-items-center text-secondary'
            >
                <IconGripVertical
                    :size='18'
                    stroke='1'
                />
            </div>

            <span
                class='avatar avatar-sm rounded-circle feature-row__icon flex-shrink-0'
                :title='props.error ? "This change is saved on this device and has not reached the server yet" : undefined'
            >
                <ContactPuck
                    v-if='feature.properties.group'
                    :team='feature.properties.group.name'
                    :size='20'
                />
                <FeatureIcon
                    v-else
                    :feature='feature'
                    :error='props.error'
                />
            </span>

            <div
                class='flex-grow-1 d-flex flex-column'
                style='min-width: 0;'
            >
                <span
                    v-if='(feature.properties.callsign || "").trim().length > 0'
                    class='fw-semibold text-truncate'
                    v-text='feature.properties.callsign'
                />
                <span
                    v-else
                    class='fw-semibold text-truncate fst-italic text-secondary'
                >No Callsign</span>
                <span
                    v-if='subtitle'
                    class='text-secondary small text-truncate'
                    v-text='subtitle'
                />
            </div>

            <div class='align-self-center btn-list flex-shrink-0'>
                <TablerIconButton
                    v-if='visibilityToggle'
                    :title='isHidden ? "Show Feature" : "Hide Feature"'
                    @click.stop.prevent='toggleVisibility'
                >
                    <IconEyeOff
                        v-if='isHidden'
                        :size='20'
                        stroke='1'
                    />
                    <IconEye
                        v-else
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-if='infoButton'
                    title='View Info'
                    @click.stop.prevent='router.push(`/cot/${feature.id}`)'
                >
                    <IconListDetails
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerDelete
                    v-if='deleteButton && deleteAction === "delete"'
                    :size='20'
                    displaytype='icon'
                    @delete='deleteCOT'
                />
                <TablerIconButton
                    v-else-if='deleteButton'
                    title='Remove'
                    @click.stop.prevent='deleteCOT'
                >
                    <IconTrash
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </StandardItem>
    </div>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import { ref, computed, watch, onMounted } from 'vue';
import COT from '../../../base/cot.ts';
import Config from '../../../base/config.ts';
import type { FullConfig } from '../../../base/config.ts';
import { TEAM_COLORS } from '../../../utils/team-colors.ts';
import { FeatureVisibility } from '../../../stores/modules/feature-visibility.ts';
import FeatureIcon from './FeatureIcon.vue';
import ContactPuck from './ContactPuck.vue';
import StandardItem from './StandardItem.vue';
import {
    TablerDelete,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconListDetails,
    IconGripVertical,
    IconTrash,
    IconEye,
    IconEyeOff,
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();

const props = defineProps({
    feature: {
        type: Object,
        required: true
    },
    select: {
        type: Boolean,
        default: false
    },
    deleteButton: {
        type: Boolean,
        default: true
    },
    deleteAction: {
        type: String,
        default: 'delete' //emit or delete
    },
    gripHandle: {
        type: Boolean,
        default: false
    },
    infoButton: {
        type: Boolean,
        default: false
    },
    visibilityToggle: {
        type: Boolean,
        default: false
    },
    error: {
        type: Boolean,
        default: false
    },
    hover: {
        type: Boolean,
        default: true
    },
    detail: {
        type: String,
        default: ''
    }
});

const router = useRouter();
const emit = defineEmits(['delete']);

const isDeleted = ref(false);
const isDeleting = ref(false);
const isZoomable = ref(false);

const isHidden = computed(() => FeatureVisibility.isFeatureHidden(props.feature.id));

const typeName = ref('');
const teamName = ref('');

const subtitle = computed(() => {
    if (props.detail) return props.detail;

    const group = props.feature.properties.group;
    if (!group) return typeName.value;

    return [group.role, teamName.value || group.name].filter(Boolean).join(' · ');
});

watch(() => props.feature.properties.group?.name, async (team: string | undefined) => {
    teamName.value = '';
    if (!team || !(team in TEAM_COLORS)) return;

    const config = await Config.get(`group::${team}` as keyof FullConfig);
    const name = typeof config?.value === 'string' ? config.value.trim() : '';

    if (props.feature.properties.group?.name === team) teamName.value = name;
}, { immediate: true });

watch(() => props.feature.properties.type, async (type: string | undefined) => {
    typeName.value = type || '';
    if (!type) return;

    const resolved = await COT.resolveType(type);
    if (props.feature.properties.type === type) typeName.value = resolved.name;
}, { immediate: true });

function toggleVisibility() {
    FeatureVisibility.toggleFeature(props.feature.id);
}

onMounted(async () => {
    const cot = await mapStore.worker.db.get(props.feature.id, {
        mission: true
    })

    isZoomable.value = cot ? true : false;
})

async function deleteCOT() {
    if (props.deleteAction === 'delete') {
        isDeleting.value = true;

        await mapStore.worker.db.remove(props.feature.id, {
            mission: true
        });

        isDeleting.value = false;
        isDeleted.value = true;
    } else {
        emit('delete');
    }
}

async function selectClick() {
    if (!props.select && !(props.feature instanceof COT)) return;

    mapStore.selected.set(props.feature.id, props.feature as COT);
}

async function flyToClick() {
    if (!props.hover || !isZoomable.value || isDeleting.value || isDeleted.value) return;

    const cot = await mapStore.worker.db.get(props.feature.id, {
        mission: true
    });

    if (!cot) throw new Error('Could not find marker');

    cot.flyTo();
}
</script>

<style scoped>
.feature-row__icon {
    --tblr-avatar-size: 2.25rem;
    color: var(--tblr-body-color);
    background-color: var(--cloudtak-inset-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--cloudtak-inset-border, rgba(255, 255, 255, 0.12));
    transition: border-color 0.15s ease, color 0.15s ease;
}

.feature-row:hover .feature-row__icon,
.feature-row:focus-within .feature-row__icon {
    color: var(--tblr-primary);
    border-color: rgba(var(--tblr-primary-rgb), 0.4);
}
</style>
