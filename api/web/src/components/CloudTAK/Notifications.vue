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
            v-if='availableTypes.length > 1'
            class='d-flex flex-wrap justify-content-center gap-2 p-2 border-bottom'
        >
            <div
                v-for='type in availableTypes'
                :key='type'
                class='d-flex flex-column align-items-center justify-content-center p-2 rounded cursor-pointer border'
                :class='selectedTypes.includes(type) ? "border-primary" : "border-transparent"'
                style='width: 60px; height: 60px;'
                @click.stop.prevent='toggleType(type)'
            >
                <NotificationIcon
                    :type='type'
                    :size='24'
                />
                <div
                    style='font-size: 0.65rem;'
                    class='mt-1'
                >
                    {{ type }}
                </div>
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
                    <div class='ms-auto'>
                        <TablerIconButton
                            title='Delete'
                            @click.stop.prevent='TAKNotification.delete(n.id)'
                        >
                            <IconTrash
                                :size='20'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <NotificationToast
        v-for='n in filteredListToast'
        :id='n.id'
        :key='n.id'
        @close='TAKNotification.update(n.id, { toast: false })'
    />
</template>

<script setup lang='ts'>
import { from } from 'rxjs';
import { ref, computed } from 'vue';
import { liveQuery } from 'dexie';
import { useRouter } from 'vue-router';
import { useObservable } from '@vueuse/rxjs';
import TAKNotification, { NotificationType } from '../../base/notification.ts';
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

const selectedTypes = ref<NotificationType[]>(Object.values(NotificationType));

const availableTypes = computed(() => {
    if (!list.value) return [];
    const present = new Set(list.value.map(n => n.type));
    return Object.values(NotificationType).filter(t => present.has(t));
});

const toggleType = (type: NotificationType) => {
    if (selectedTypes.value.includes(type)) {
        selectedTypes.value = selectedTypes.value.filter(t => t !== type);
    } else {
        selectedTypes.value.push(type);
    }
}

const paging = ref({
    shown: false,
    filter: ''
})

const filteredList = computed(() => {
    if (!list.value) return [];
    return list.value.filter((n) => {
        if (!selectedTypes.value.includes(n.type)) return false;
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
