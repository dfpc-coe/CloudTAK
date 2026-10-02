import type { CoreEntityBoardColumn, CoreEntityBoardEvent } from '../../types.ts';

/** A Column with the Events currently placed in it */
export type BoardColumn = CoreEntityBoardColumn & {
    events: Array<CoreEntityBoardEvent>;
};
