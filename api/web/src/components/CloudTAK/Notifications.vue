<template>
    <div
        class='card'
        style='min-width: 400px;'
    >
        <div class='card-header d-flex align-items-center'>
            <h3 class='card-title'>
                Notifications
            </h3>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='mapStore.notifications.length'
                    title='Search'
                    @click.stop.prevent='paging.shown = !paging.shown'
                >
                    <IconSearch
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-if='mapStore.notifications.length'
                    title='Delete All'
                    @click='mapStore.notifications.splice(0, mapStore.notifications.length)'
                >
                    <IconTrash
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-if='paging.shown'
            class='col-12'
        >
            <TablerInput
                v-model='paging.filter'
                icon='search'
                :autofocus='true'
            />
        </div>
        <TablerNone
            v-if='list.length === 0'
            label='Notifications'
            :create='false'
        />
        <div
            v-else
            class='list-group list-group-flush list-group-hoverable'
        >
            <div
                v-for='n in list'
                class='list-group-item cursor-pointer'
                data-toggle='collapse'
                @click='follow(n)'
            >
                <div class='d-flex align-items-center'>
                    <div class='me-2'>
                        <IconAlertTriangle
                            v-if='n.type === "Alert"'
                            :size='32'
                            stroke='1'
                        />
                        <IconHeartbeat
                            v-else-if='n.type === "Medical"'
                            :size='32'
                            stroke='1'
                        />
                        <IconMessage
                            v-else-if='n.type === "Chat"'
                            :size='32'
                            stroke='1'
                        />
                        <IconUser
                            v-else-if='n.type === "Contact"'
                            :size='32'
                            stroke='1'
                        />
                        <IconAmbulance
                            v-else-if='n.type === "Mission"'
                            :size='32'
                            stroke='1'
                        />
                        <IconCircleDot
                            v-else
                            :size='32'
                            stroke='1'
                        />
                    </div>
                    <div class='text-truncate'>
                        <div
                            class='text-body d-block'
                            v-text='n.name'
                        />
                        <div
                            v-if='n.body'
                            class='d-block text-secondary text-truncate mt-n1'
                            v-text='n.body'
                        />
                        <div
                            class='d-block text-secondary text-truncate mt-n1'
                            v-text='timeDiff(n.created)'
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMapStore } from '../../stores/map.ts';
import type { TAKNotification } from '../../stores/map.ts';
import timeDiff from '../../timediff.ts';
import {
    TablerNone,
    TablerInput,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconUser,
    IconTrash,
    IconSearch,
    IconMessage,
    IconAlertTriangle,
    IconHeartbeat,
    IconAmbulance,
    IconCircleDot,
} from '@tabler/icons-vue';

const router = useRouter();
const mapStore = useMapStore();

const paging = ref({
    shown: false,
    filter: ''
})

const list = computed(() => {
    return mapStore.notifications.filter((n) => {
        return n.name.toLowerCase().includes(paging.value.filter.toLowerCase())
    })
});

function follow(n: TAKNotification) {
    router.push(n.url)
}

</script>
