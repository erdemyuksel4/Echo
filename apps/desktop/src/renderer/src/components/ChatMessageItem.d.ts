import React from 'react';
import { type Message, type GroupMember } from '@echo/shared';
interface Props {
    message: Message;
    channelId: string;
    member?: GroupMember;
    currentUserRole?: 'owner' | 'admin' | 'member';
}
export declare const ChatMessageItem: React.FC<Props>;
export {};
