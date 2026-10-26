<template>
    <MenuTemplate
        name='Mission Changes'
        :zindex='0'
        :back='false'
        :border='false'
        :loading='loading || !changes'
        :standalone='false'
    >
        <div
            v-if='error'
            class='px-2 pt-2'
        >
            <TablerInlineAlert
                severity='danger'
                title='Failed to load Mission Changes'
                :description='error.message'
            />
            <div class='d-flex justify-content-center'>
                <TablerButton
                    :loading='loading || fetchingAll'
                    @click='retry'
                >
                    Retry
                </TablerButton>
            </div>
        </div>
        <TablerNone
            v-if='changes && !changes.length'
            :create='false'
            label='No Recent Mission Changes'
        />
        <div
            v-if='changes'
            class='col-12 px-2 py-2'
        >
            <StandardItem
                v-for='change in changes'
                :key='change.contentUid'
                class='px-2 py-2 mb-1 d-flex flex-wrap align-items-center'
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
                        class='mx-2'
                        :title='change.contentUid'
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
                        class='mx-2'
                        :title='change.contentUid'
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
            <div
                v-if='!fetchedAll'
                class='d-flex justify-content-center mt-2'
            >
                <TablerButton
                    :loading='fetchingAll'
                    @click='fetchAll'
                >
                    Fetch All Changes
                </TablerButton>
            </div>
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { from } from 'rxjs';
import { liveQuery } from '../../../../database.ts';
import { useObservable } from "@vueuse/rxjs";
import type { Ref } from 'vue';
import Subscription from '../../../../base/subscription.ts';
import type { MissionChange } from '../../../../types.ts';
import {
    IconSquarePlus,
    IconSquareX,
    IconMessage,
    IconFileX,
    IconFile,
    IconPolygon,
} from '@tabler/icons-vue';
import {
    TablerInlineAlert,
    TablerNone,
    TablerButton,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import StandardItem from '../../util/StandardItem.vue';

const props = defineProps<{
    subscription: Subscription
}>();

const error = ref<Error | undefined>();
const loading = ref(true);
const fetchingAll = ref(false);
const fetchedAll = ref(false);
const lastAll = ref(false);
const changes: Ref<Array<MissionChange>> = useObservable(
    from(liveQuery(async () => {
        return await props.subscription.change.list()
    }))
)

onMounted(async () => {
    await load(false);
    loading.value = false;
});

async function fetchAll(): Promise<void> {
    fetchingAll.value = true;
    await load(true);
    fetchingAll.value = false;
}

async function retry(): Promise<void> {
    if (lastAll.value) {
        await fetchAll();
    } else {
        loading.value = true;
        await load(false);
        loading.value = false;
    }
}

async function load(all: boolean): Promise<void> {
    lastAll.value = all;
    error.value = undefined;

    try {
        await props.subscription.change.refresh({ all });
        if (all) fetchedAll.value = true;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
