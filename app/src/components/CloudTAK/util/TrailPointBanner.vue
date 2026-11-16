<template>
    <div
        v-if='uid'
        class='px-3 py-2 border-bottom flex-shrink-0'
    >
        <div class='small text-muted mb-2'>
            A recorded position from a breadcrumb trail
        </div>
        <TrailActions
            :uid='uid'
            @clear='confirming = true'
        />
        <TrailClearDialog
            v-if='confirming'
            :uid='uid'
            @close='confirming = false'
            @cleared='onCleared'
        />
    </div>
</template>

<script setup lang='ts'>
/**
 * Shown above a feature in the feature viewer when that feature is a point of
 * a breadcrumb trail, so the trail can be framed or cleared from there (TAK.NZ-only).
 */
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import TrailActions from './TrailActions.vue';
import TrailClearDialog from './TrailClearDialog.vue';
import { historyPointUid } from '../../../base/trail.ts';

const props = defineProps<{
    featureId?: string | number
}>();

const router = useRouter();
const uid = ref<string | undefined>(undefined);
const confirming = ref(false);

watch(() => props.featureId, async (id) => {
    uid.value = undefined;
    confirming.value = false;
    try {
        uid.value = await historyPointUid(id);
    } catch (err) {
        console.error('Failed to look up the trail of a feature', err);
    }
}, { immediate: true });

// The point being viewed went with the trail
function onCleared(): void {
    uid.value = undefined;
    void router.push('/menu/history');
}
</script>
