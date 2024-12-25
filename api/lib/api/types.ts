import { TSchema, Type } from '@sinclair/typebox';

export const TAKItem = <T extends TSchema>(T: T) => {
    return Type.Object({
        version: Type.String(),
        type: Type.String(),
        data: T,
        messages: Type.Optional(Type.Array(Type.String())),
        nodeId: Type.Optional(Type.String())
    })
};

export const TAKList = <T extends TSchema>(T: T) => {
    return TAKItem(Type.Array(T));
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
