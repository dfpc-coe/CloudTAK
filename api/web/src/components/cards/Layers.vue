<template>
<div class="card card-sm">
    <div class="card-body">
        <div class="row align-items-center">
            <div class="col-auto">
                <span @click='$router.push("/layer")' class="bg-primary text-white avatar cursor-pointer">
                    <DatabaseIcon/>
                </span>
            </div>
            <div class="col">
                <div class="font-weight-medium">
                    <span v-text='list.total'/> Layers
                </div>
                <div class="text-muted">
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    DatabaseIcon
} from 'vue-tabler-icons';

export default {
    name: 'CardLayers',
    data: function() {
        return {
            list: {
                total: 0
            }
        }
    },
    mounted: async function() {
        await this.fetch()
    },
    methods: {
        fetch: async function() {
            this.list = await window.std('/api/layer?limit=1');
        }
    },
    components: {
        DatabaseIcon
    }
}
</script>
