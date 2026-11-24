import { sql } from 'drizzle-orm';

import type ConfigStateless from '../../config.js';
import { ProfileChat, ProfileChatroom } from '../../../common/schema.js';
import type { RetentionTask, RetentionTaskResult } from '../retention.js';

const task: RetentionTask = {
    name: 'chat',
    run: async (config: ConfigStateless): Promise<RetentionTaskResult> => {
        const start = Date.now();

        const days = (await config.models.Setting.typed('retention::chat::days')).value || 30;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const deleted = await config.models.ProfileChat.pool.delete(ProfileChat)
            .where(sql`
                ${ProfileChat.created} < ${cutoff.toISOString()}::timestamptz
            `)
            .returning({ deleted: sql<number>`1` });

        await config.models.ProfileChatroom.pool.delete(ProfileChatroom)
            .where(sql`
                profile_chatroom.updated < ${cutoff.toISOString()}::timestamptz
                AND NOT EXISTS (
                    SELECT 1
                        FROM profile_chats
                        WHERE profile_chats.username = profile_chatroom.username
                            AND profile_chats.chatroom = profile_chatroom.id
                )
            `);

        return {
            name: task.name,
            status: 'success',
            deleted: deleted.length,
            duration: Date.now() - start,
            message: deleted.length ? undefined : 'No expired chat messages found',
        };
    },
};

export default task;
