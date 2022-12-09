<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item"><a @click='$router.push("/")' class="cursor-pointer">Home</a></li>
                            <li class="breadcrumb-item" aria-current="page"><a  @click='$router.push("/layer")' class="cursor-pointer">Layer</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><a href="#">New</a></li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class="card-body">
                            <div class='row row-cards'>
                                <div class="col-md-12">
                                    <TablerInput
                                        label='Layer Name'
                                        v-model='layer.name'
                                        :error='errors.name'
                                    />
                                </div>
                                <div class="col-md-6">
                                    <label class="row">
                                        <span class="col">
                                            <label class='form-label'>Scheduled</label>
                                        </span>
                                        <span class="col-auto">
                                            <label class="form-check form-check-single form-switch">
                                                <input v-model='layer.enabled' class="form-check-input" type="checkbox">
                                            </label>
                                        </span>
                                    </label>
                                    <input v-model='layer.cron' type="text" :class='{
                                        "is-invalid": errors.cron
                                    }' class="form-control" placeholder="CRON Schedule">
                                    <div v-if='errors.cron' v-text='errors.cron' class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Layer Task</label>
                                    <input v-model='layer.task' type="text" :class='{
                                        "is-invalid": errors.task
                                    }' class="form-control" placeholder="Layer Task">
                                    <div v-if='errors.task' v-text='errors.task' class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-12">
                                    <TablerInput
                                        label='Layer Description'
                                        :rows='6'
                                        v-model='layer.description'
                                        :error='errors.description'
                                    />
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label">Connection</label>
                                    <div class='d-flex'>
                                        <template v-if='conn.id'>
                                            <ConnectionStatus :connection='conn'/>
                                            <span class='mt-2' v-text='conn.name'/>
                                        </template>
                                        <template v-else>
                                            Select A Connection Using the Gear Icon on the right
                                        </template>

                                        <div class='ms-auto'>
                                            <div class="dropdown">
                                                <div class="dropdown-toggle" type="button" id="dropdownMenuButton1" data-bs-toggle="dropdown" aria-expanded="false">
                                                    <SettingsIcon
                                                        class='cursor-pointer dropdown-toggle'
                                                    />
                                                </div>
                                                <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton1">
                                                    <div class='m-1'>
                                                        <div class='table-resposive'>
                                                            <table class='table table-hover'>
                                                                <thead>
                                                                    <tr>
                                                                        <th>(Status) Name</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody class='table-tbody'>
                                                                    <tr @click='conn = connection' :key='connection.id' v-for='connection of connections.connections' class='cursor-pointer'>
                                                                        <td>
                                                                            <div class='d-flex'>
                                                                                <ConnectionStatus :connection='connection'/>
                                                                                <span class='mt-2' v-text='connection.name'/>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12">
                    <StyleUtil v-model='layer.styles'/>
                </div>

                <div class="col-lg-12">
                    <div class='card'>
                        <div class="card-body">
                            <div class='d-flex'>
                                <a v-if='$route.params.layerid' @click='create' class="cursor-pointer btn btn-outline-danger">
                                    Delete Layer
                                </a>
                                <div class='ms-auto'>
                                    <a v-if='$route.params.layerid' @click='create' class="cursor-pointer btn btn-primary">Update Layer</a>
                                    <a v-else @click='create' class="cursor-pointer btn btn-primary">Create Layer</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
    <Err v-if='err' :err='err' @close='err = null'/>
</div>
</template>

<script>
import ConnectionStatus from './Connection/Status.vue';
import PageFooter from './PageFooter.vue';
import StyleUtil from './util/Styles.vue';
import { Err, Input } from '@tak-ps/vue-tabler';
import {
    SettingsIcon
} from 'vue-tabler-icons';

export default {
    name: 'LayerEdit',
    data: function() {
        return {
            err: false,
            connections: {
                list: []
            },
            errors: {
                name: '',
                description: '',
                cron: '',
                task: ''
            },
            conn: {
                id: null,
                status: '',
                name: ''
            },
            layer: {
                name: '',
                description: '',
                enabled: true,
                cron: '0/15 * * * ? *',
                task: '',
                styles: {}
            }
        }
    },
    mounted: function() {
        this.listConnections();

        if (this.$route.params.layerid) this.fetch();
    },
    methods: {
        listConnections: async function() {
            try {
                this.connections = await window.std('/api/connection');
            } catch (err) {
                this.err = err;
            }
        },
        fetch: async function() {
            try {
                this.layer = await window.std(`/api/layer/${this.$route.params.layerid}`);
                this.conn = await window.std(`/api/connection/${this.layer.connection}`);
            } catch (err) {
                this.err = err;
            }
        },
        create: async function() {
            for (const field of ['name', 'description', 'cron', 'task']) {
                if (!this.layer[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = '';
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            try {
                let url, method;
                if (this.$route.params.layerid) {
                    url = window.stdurl(`/api/layer/${this.$route.params.layerid}`);
                    method = 'PATCH'
                } else {
                    url = window.urlstd(`/api/layer`);
                    method = 'POST'
                }

                const create = await window.std(url, {
                    method,
                    body: {
                        name: this.layer.name,
                        description: this.layer.description,
                        enabled: this.layer.enabled,
                        connection: this.conn.id,
                        cron: this.layer.cron,
                        task: this.layer.task,
                        styles: this.layer.styles
                    }
                });

                this.$router.push(`/layer/${create.id}`);
            } catch (err) {
                this.err = err;
            }
        }
    },
    components: {
        Err,
        PageFooter,
        ConnectionStatus,
        TablerInput: Input,
        StyleUtil,
        SettingsIcon
    }
}
</script>
