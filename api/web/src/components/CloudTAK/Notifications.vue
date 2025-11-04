<template>
    <div
        class='card'
        style='
            min-width: 400px;
            max-height: 50vh;
        '
    >
        <div class='card-header d-flex align-items-center'>
            <h3 class='card-title'>
                Notifications
            </h3>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='list && list.length'
                    title='Search'
                    @click.stop.prevent='paging.shown = !paging.shown'
                >
                    <IconSearch
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-if='list && list.length'
                    title='Delete All'
                    @click='TAKNotification.clear()'
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
            class='col-12 px-2'
        >
            <TablerInput
                v-model='paging.filter'
                icon='search'
                :autofocus='true'
            />
        </div>
        <TablerNone
            v-if='!filteredList || filteredList.length === 0'
            label='Notifications'
            :create='false'
        />
        <div
            v-else
            class='overflow-auto list-group list-group-flush list-group-hoverable'
        >
            <div
                v-for='n in filteredList'
                :key='n.id'
                class='list-group-item cursor-pointer'
                data-toggle='collapse'
                @click='router.push(n.url)'
            >
                <div class='d-flex align-items-center'>
                    <div class='me-2'>
                        <NotificationIcon
                            :type='n.type'
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

    <NotificationToast
        v-for='n in filteredListToast'
        :key='n.id'
        :id='n.id'
        @close='TAKNotification.update(n.id, { toast: false })'
    />
</template>

<script setup lang='ts'>
import { from } from 'rxjs';
import { ref, computed } from 'vue';
import { liveQuery } from 'dexie';
import { useRouter } from 'vue-router';
import { useObservable } from '@vueuse/rxjs';
import TAKNotification from '../../base/notification.ts';
import NotificationToast from './util/NotificationToast.vue';
import NotificationIcon from './util/NotificationIcon.vue';
import timeDiff from '../../timediff.ts';
import {
    TablerNone,
    TablerInput,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconTrash,
    IconSearch,
} from '@tabler/icons-vue';

const router = useRouter();

const paging = ref({
    shown: false,
    filter: ''
})

const filteredList = computed(() => {
    if (!list.value) return [];
    return list.value.filter((n) => {
        return n.name.toLowerCase().includes(paging.value.filter.toLowerCase())
            || n.body.toLowerCase().includes(paging.value.filter.toLowerCase());
    })
});

const filteredListToast = computed(() => {
    if (!list.value) return [];
    return list.value.filter((n) => {
        return n.toast && !n.read;
    })
});

const list = useObservable(
    from(liveQuery(async () => {
        return await TAKNotification.list();
    }))
);
</script>
