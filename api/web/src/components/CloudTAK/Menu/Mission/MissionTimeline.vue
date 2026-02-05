<template>
    <MenuTemplate
        name='Mission Timeline'
        :zindex='0'
        :back='false'
        :border='false'
        :loading='loading'
    >
        <TablerAlert
            v-if='error'
            :error='error'
        />
        <TablerNone
            v-else-if='!changes.length'
            :create='false'
            label='No Timeline Changes'
        />
        <div
            v-else
            class='rows'
        >
            <StandardItem
                v-for='change in changes'
                :key='change.contentUid'
                class='col-12 px-2 py-2 mb-1 d-flex flex-wrap align-items-center'
                :hover='false'
            >
                <template v-if='change.type === "CREATE_MISSION"'>
                    <IconSquarePlus
                        :size='24'
                        stroke='1'
                    />
                    <span
                        class='mx-2'
                        v-text='`Mission Created: ${change.missionName}`'
                    />
                </template>
                <template v-else-if='change.type === "ADD_CONTENT" && change.contentResource'>
                    <IconFile
                        :size='24'
                        stroke='1'
                    />
                    <span
                        class='mx-2'
                        v-text='change.contentResource.name'
                    />
                </template>
                <template v-else-if='change.type === "ADD_CONTENT" && change.details && change.details.type === "b-t-f"'>
                    <IconMessage
                        :size='24'
                        stroke='1'
                    />
                    <span
                        class='mx-2'
                        v-text='"New Message"'
                    />
                </template>
                <template v-else-if='change.type === "ADD_CONTENT" && change.details'>
                    <IconPolygon
                        :size='24'
                        stroke='1'
                    />
                    <span
                        class='mx-2'
                        v-text='`${change.details.callsign} (${change.details.type})`'
                    />
                </template>
                <template v-else-if='change.type === "ADD_CONTENT"'>
                    <IconSquarePlus
                        :size='24'
                        stroke='1'
                    />
                    <span
                        v-tooltip='change.contentUid'
                        class='mx-2'
                    >Content Added</span>
                </template>
                <template v-else-if='change.type === "REMOVE_CONTENT" && change.contentResource'>
                    <IconFileX
                        :size='24'
                        stroke='1'
                    />
                    <span
                        class='mx-2'
                        v-text='change.contentResource.name'
                    />
                </template>
                <template v-else-if='change.type === "REMOVE_CONTENT"'>
                    <IconSquareX
                        :size='24'
                        stroke='1'
                    />
                    <span
                        v-tooltip='change.contentUid'
                        class='mx-2'
                    >Content Removed</span>
                </template>
                <template v-else>
                    <span v-text='change' />
                </template>
                <div class='col-12 d-flex'>
                    <label
                        class='subheader'
                        v-text='change.type'
                    />
                    <label
                        class='subheader ms-auto'
                        v-text='change.timestamp'
                    />
                </div>
            </StandardItem>
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import Subscription from '../../../../base/subscription.ts';
import type { MissionChanges } from '../../../../types.ts';
import {
    IconSquarePlus,
    IconSquareX,
    IconMessage,
    IconFileX,
    IconFile,
    IconPolygon,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerNone,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import StandardItem from '@/components/CloudTAK/util/StandardItem.vue';

const props = defineProps<{
    subscription: Subscription
}>();

const error = ref<Error | undefined>();
const loading = ref(true);
const changes = ref<MissionChanges["data"]>([]);

onMounted(async () => {
    await fetchChanges();
});

async function fetchChanges() {
    loading.value = true;
    error.value = undefined;

    try {
        changes.value = (await props.subscription.changes()).data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
    loading.value = false;
}
</script>
