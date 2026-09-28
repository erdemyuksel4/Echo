import React from 'react';
type SettingsTab = 'voice' | 'notifications' | 'about';
interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: SettingsTab;
}
export declare const SettingsModal: React.FC<Props>;
export {};
