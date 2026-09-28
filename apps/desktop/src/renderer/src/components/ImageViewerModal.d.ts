import React from 'react';
interface ImageViewerModalProps {
    imageUrl: string;
    imageName?: string;
    onClose: () => void;
}
export declare const ImageViewerModal: React.FC<ImageViewerModalProps>;
export {};
