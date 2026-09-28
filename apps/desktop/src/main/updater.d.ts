import { BrowserWindow } from 'electron';
export declare function getUpdaterPath(): string | null;
export declare function checkForUpdateAndLaunchUpdater(options?: {
    manual?: boolean;
}): Promise<{
    available: boolean;
    version?: string;
}>;
export declare function initAutoUpdater(window: BrowserWindow): void;
