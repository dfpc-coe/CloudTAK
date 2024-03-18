// Eventually derive these types directly from the API
// but manually include them here to get off the ground

export type Basemap = {
    id: number;
    created: string;
    updated: string;
    name: string;
    url: string;
    bounds?: object;
    center?: object;
    minzoom: number;
    maxzom: number;
    format: string;
    type: string;
};

export type ProfileOverlay = {
    id: number;
    name: string;
    username: string;
    created: string;
    updated: string;
    pos: number;
    type: string;
    opacity: number;
    visible: boolean;
    styles?: object;
    mode?: string;
    mode_id?: string;
    url: string;
};
