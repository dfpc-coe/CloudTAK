export type TAKList<T> = {
    version: string;
    type: string;
    data: Array<T>;
    nodeId: string;
}

export type TAKItem<T> = {
    version: string;
    type: string;
    data: T;
    nodeId: string;
}

export enum TAKGroup {
    WHITE = "White",
    YELLOW = "Yellow",
    ORANGE = "Orange",
    MAGENTA = "Magenta",
    RED = "Red",
    MAROON = "Maroon",
    PURPLE = "Purple",
    DARK_BLUE = "Dark Blue",
    BLUE = "Blue",
    CYAN = "Cyan",
    TEAL = "Teal",
    GREEN = "Green",
    DARK_GREEN = "Dark Green",
    BROWN = "Brown"
}

export enum TAKRole {
    TEAM_MEMBER = "Team Member",
    TEAM_LEAD = "Team Lead",
    HQ = "HQ",
    SNIPER = "Sniper",
    MEDIC = "Medic",
    FORWARD_OBSERVER = "Forward Observer",
    RTO = "RTO",
    K9 = "K9"
}
