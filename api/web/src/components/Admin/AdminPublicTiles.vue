<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Hosted Tilesets
            </h1>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    :title='uploading ? "Hide Upload" : "Upload Tileset"'
                    @click='toggleUpload'
                >
                    <IconUpload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <TablerAlert
            v-if='error'
            :err='error'
            @close='error = undefined'
        />

        <div
            v-if='uploading'
            class='card m-3'
        >
            <Upload
                :url='uploadUrl'
                :headers='uploadHeaders'
                mimetype='.pmtiles'
                label='Upload a .pmtiles file to the hosted tileset directory'
                @cancel='uploading = false'
                @done='onUploadDone'
                @error='error = $event'
            />
        </div>

        <div class='card-body'>
            <div class='row g-3'>
                <div class='col-12 col-xl-5'>
                    <PublicTilesSelect
                        :key='tilesetKey'
                        @select='selected = $event as PublicTile'
                    />
                </div>

                <div class='col-12 col-xl-7'>
                    <TablerNone
                        v-if='!selected'
                        :create='false'
                        label='Select a Hosted Tileset'
                    />

                    <div
                        v-else
                        class='row g-3'
                    >
                        <div class='col-12'>
                            <label class='form-label'>Tileset Details</label>
                            <div class='card'>
                                <div class='card-body datagrid'>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>
                                            Name
                                        </div>
                                        <div class='datagrid-content'>
                                            {{ selected.name }}
                                        </div>
                                    </div>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>
                                            TileJSON URL
                                        </div>
                                        <div class='datagrid-content text-break'>
                                            <a
                                                :href='selected.url'
                                                target='_blank'
                                                rel='noopener noreferrer'
                                            >{{ selected.url }}</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <TileJSONView :overlay='selected' />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import {
    TablerAlert,
    TablerIconButton,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconUpload,
} from '@tabler/icons-vue';
import type { TileJSON } from '../../types.js';
import Upload from '../util/Upload.vue';
import PublicTilesSelect from '../util/PublicTilesSelect.vue';
import TileJSONView from './TileJSONView.vue';

type PublicTile = TileJSON & {
    name: string;
    url: string;
};

const error = ref<Error | undefined>();
const selected = ref<PublicTile>();
const uploading = ref(false);
const tilesetKey = ref(0);

const uploadUrl = computed(() => new URL('/api/server/tileset', window.location.origin));
const uploadHeaders = computed(() => {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
});

function toggleUpload() {
    error.value = undefined;
    uploading.value = !uploading.value;
}

function onUploadDone() {
    error.value = undefined;
    uploading.value = false;
    selected.value = undefined;
    tilesetKey.value++;
}
</script>