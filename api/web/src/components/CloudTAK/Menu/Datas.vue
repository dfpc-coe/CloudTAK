<template>
    <MenuTemplate name='Overlay Explorer'>
        <div class='row g-0 py-2'>
            <div class='col-6 px-2'>
                <button
                    class='btn btn-primary w-100'
                    @click='$router.push("/menu/datas/user")'
                >
                    <IconUser
                        :size='32'
                        :stroke='1'
                    />User Overlays
                </button>
            </div>
            <div class='col-6 px-2'>
                <button
                    class='btn btn-secondary w-100'
                    @click='$router.push("/menu/datas/sync")'
                >
                    <IconDatabase
                        :size='32'
                        :stroke='1'
                    />DataSync Overlays
                </button>
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <template v-else>
            <TablerNone
                v-if='!overlays.total'
                label='Server Overlays'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='a in overlays.items'
                    :key='a.id'
                    class='cursor-pointer col-12 py-2 px-3 hover-dark'
                >
                    <div class='col-12 py-2 px-2 d-flex align-items-center'>
                        <span
                            class='mx-2 cursor-pointer'
                            v-text='a.name'
                        />
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconDatabase,
    IconUser,
} from '@tabler/icons-vue'

export default {
    name: 'CloudTAKDatas',
    components: {
        IconUser,
        IconDatabase,
        TablerNone,
        TablerLoading,
        MenuTemplate
    },
    data: function() {
        return {
            loading: false,
            overlays: {
                total: 0,
                items: []
            }
        }
    }
}
</script>
