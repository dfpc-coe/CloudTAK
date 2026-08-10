import type { CoreEventBoardColumn, CoreEventBoardEvent } from '../../types.ts';

/** A Column with the Events currently placed in it */
export type BoardColumn = CoreEventBoardColumn & {
    events: Array<CoreEventBoardEvent>;
};
