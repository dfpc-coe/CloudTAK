export interface PluginInstance {
}

export interface PluginStatic {
    install(): PluginInstance;
}
