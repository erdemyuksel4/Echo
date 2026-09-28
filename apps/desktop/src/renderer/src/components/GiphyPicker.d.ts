import React from 'react';
import type { GiphyItem } from '@echo/shared';
interface GiphyPickerProps {
    onSelect: (gif: GiphyItem) => void;
    onClose: () => void;
}
export declare const GiphyPicker: React.FC<GiphyPickerProps>;
export {};
