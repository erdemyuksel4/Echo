import React from 'react';
interface Props {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
    isOwner: boolean;
}
export declare const DeleteGroupModal: React.FC<Props>;
export {};
