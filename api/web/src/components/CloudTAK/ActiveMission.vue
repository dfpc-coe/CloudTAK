<template>
    <div
        class='d-flex text-white align-items-center py-2 px-2'
        style='
            z-index: 1;
            max-width: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 0px 0px 6px 0px;
        '
    >
        <template v-if='!mapStore.mission'>
            <div
                class='hover-button d-flex align-items-center user-select-none cursor-pointer rounded px-2'
                style='height: 40px;'
                @click='router.push("/menu/missions")'
            >
                <IconMap
                    :size='32'
                    stroke='1'
                    class='me-2'
                />
                <div class='me-2 font-weight-bold'>
                    No Active Data Sync
                </div>
            </div>
        </template>
        <template v-else>
            <div
                class='d-flex align-items-center user-select-none cursor-pointer hover-button rounded px-2 me-2'
                style='height: 40px;'
                @click='router.push(`/menu/missions/${mapStore.mission.meta.guid}`)'
            >
                <IconAmbulance
                    :size='32'
                    stroke='1'
                    class='me-2'
                />

                <span
                    class='text-truncate fw-bold'
                    style='max-width: 200px;'
                    v-text='mapStore.mission.meta.name'
                />
            </div>

            <div
                class='border-start border-white opacity-50 mx-1'
                style='height: 32px;'
            />

            <div class='d-flex gap-1 ms-2'>
                <TablerIconButton
                    title='Layers'
                    class='hover-button'
                    :hover='false'
                    @click='router.push(`/menu/missions/${mapStore.mission.meta.guid}/layers`)'
                >
                    <IconBoxMultiple
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    title='Changes'
                    class='hover-button'
                    :hover='false'
                    @click='router.push(`/menu/missions/${mapStore.mission.meta.guid}/changes`)'
                >
                    <IconTimeline
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    title='Users'
                    class='hover-button'
                    :hover='false'
                    @click='router.push(`/menu/missions/${mapStore.mission.meta.guid}/users`)'
                >
                    <IconUsers
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <div class="position-relative">
                    <TablerIconButton
                        title='Logs'
                        class='hover-button'
                        :hover='false'
                        @click='router.push(`/menu/missions/${mapStore.mission.meta.guid}/logs`)'
                    >
                        <IconArticle
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <span
                        v-if="unreadLogs && unreadLogs > 0"
                        class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger text-white fw-bold shadow-sm border border-dark"
                        style="font-size: 0.75rem; z-index: 10;"
                    >
                        {{ unreadLogs > 99 ? '99+' : unreadLogs }}
                    </span>
                </div>

                <TablerIconButton
                    title='Files'
                    class='hover-button'
                    :hover='false'
                    @click='router.push(`/menu/missions/${mapStore.mission.meta.guid}/contents`)'
                >
                    <IconFiles
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import { useMapStore } from '../../stores/map.ts';
import { db } from '../../base/database.ts';
import { liveQuery } from 'dexie';
import { useObservable } from '@vueuse/rxjs';
import { from } from 'rxjs';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import {
    IconAmbulance,
    IconMap,
    IconBoxMultiple,
    IconTimeline,
    IconUsers,
    IconArticle,
    IconFiles
} from '@tabler/icons-vue';

const mapStore = useMapStore();
const router = useRouter();

const unreadLogs = useObservable(
    from(liveQuery(async () => {
        if (!mapStore.mission) return 0;
        return await db.subscription_log
            .where('mission')
            .equals(mapStore.mission.meta.guid)
            .filter(l => l.read === false)
            .count();
    }))
);
</script>
