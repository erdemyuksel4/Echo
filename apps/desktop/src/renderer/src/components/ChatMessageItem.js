import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { CornerUpLeft, Pencil, Trash2, Smile, FileText, Download, CheckCircle2, AlertCircle, Loader2, } from 'lucide-react';
import { parseMarkdownTokens, } from '@echo/shared';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { wsService } from '../services/websocket';
import { p2pFileTransferService } from '../services/p2pFileTransfer';
import { ImageViewerModal } from './ImageViewerModal';
import { SERVER_HTTP_URL } from '../config';
function formatBytes(bytes, decimals = 1) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
const P2PFileCard = ({ attachment, authorId, isAuthor }) => {
    const [progress, setProgress] = useState(() => p2pFileTransferService.getProgress(attachment.id));
    useEffect(() => {
        const unsub = p2pFileTransferService.subscribe((p) => {
            if (p.offerId === attachment.id) {
                setProgress({ ...p });
            }
        });
        return unsub;
    }, [attachment.id]);
    const handleDownload = () => {
        if (!attachment.p2pOffer)
            return;
        p2pFileTransferService.startDownload(authorId, attachment.id, attachment.p2pOffer.fileHash, attachment.name, attachment.size, attachment.mimeType);
    };
    const status = progress?.status || 'idle';
    const percent = progress?.progress || 0;
    return (_jsxs("div", { className: "flex flex-col gap-2 max-w-sm rounded-xl border border-slate-700/80 bg-slate-950/80 p-3 shadow-md hover:border-indigo-500/50 transition", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30", children: _jsx(FileText, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-semibold text-white truncate", title: attachment.name, children: attachment.name }), _jsxs("div", { className: "flex items-center gap-2 text-[10px] text-slate-400", children: [_jsx("span", { children: formatBytes(attachment.size) }), _jsx("span", { children: "\u2022" }), _jsxs("span", { className: "font-mono text-slate-500", children: ["SHA: ", attachment.p2pOffer?.fileHash.slice(0, 8), "..."] })] })] }), isAuthor ? (_jsxs("div", { className: "flex items-center gap-1.5 rounded-md bg-slate-800/80 px-2 py-1 text-[10px] text-emerald-400 border border-emerald-500/30", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" }), _jsx("span", { children: "Payla\u015F\u0131l\u0131yor" })] })) : status === 'completed' ? (_jsxs("div", { className: "flex items-center gap-1 text-emerald-400 text-xs font-medium px-2 py-1", children: [_jsx(CheckCircle2, { className: "h-4 w-4" }), _jsx("span", { children: "\u0130ndirildi" })] })) : status === 'transferring' ? (_jsxs("div", { className: "flex items-center gap-1 text-indigo-400 text-xs font-mono font-bold", children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), _jsxs("span", { children: ["%", percent] })] })) : status === 'connecting' ? (_jsxs("div", { className: "flex items-center gap-1 text-amber-400 text-xs font-medium", children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), _jsx("span", { children: "Ba\u011Flan\u0131yor..." })] })) : (_jsxs("button", { onClick: handleDownload, className: "flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 transition shadow", title: "P2P \u0130ndir", children: [_jsx(Download, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u0130ndir" })] }))] }), status === 'transferring' && (_jsx("div", { className: "w-full bg-slate-800 rounded-full h-1.5 overflow-hidden", children: _jsx("div", { className: "bg-indigo-500 h-1.5 rounded-full transition-all duration-150", style: { width: `${percent}%` } }) })), status === 'error' && progress?.error && (_jsxs("div", { className: "flex items-center gap-1 text-[11px] text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-800/40", children: [_jsx(AlertCircle, { className: "h-3.5 w-3.5 flex-shrink-0" }), _jsx("span", { className: "truncate", children: progress.error })] }))] }));
};
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '🚀', '👀'];
export const ChatMessageItem = ({ message, channelId, member, currentUserRole = 'member', }) => {
    const { identity } = useAuthStore();
    const { setReplyingTo } = useChatStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [revealedSpoilers, setRevealedSpoilers] = useState({});
    const [viewerImage, setViewerImage] = useState(null);
    const isAuthor = identity?.userId === message.authorId;
    const canDelete = isAuthor || currentUserRole === 'owner' || currentUserRole === 'admin';
    const avatarColor = member?.pubkey ? '#' + member.pubkey.substring(0, 6) : '#6366f1';
    const formatTime = (timestamp) => {
        const d = new Date(timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    const handleSaveEdit = (e) => {
        if (e)
            e.preventDefault();
        if (!editContent.trim())
            return;
        if (editContent.trim() !== message.content) {
            wsService.editMessage(channelId, message.id, editContent.trim());
        }
        setIsEditing(false);
    };
    const handleCancelEdit = () => {
        setEditContent(message.content);
        setIsEditing(false);
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit();
        }
        else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };
    const handleToggleReaction = (emoji) => {
        if (!identity?.userId)
            return;
        const currentList = message.reactions?.[emoji] ?? [];
        const hasReacted = currentList.includes(identity.userId);
        if (hasReacted) {
            wsService.removeReaction(channelId, message.id, emoji);
        }
        else {
            wsService.addReaction(channelId, message.id, emoji);
        }
        setShowEmojiPicker(false);
    };
    const toggleSpoiler = (index) => {
        setRevealedSpoilers((prev) => ({ ...prev, [index]: !prev[index] }));
    };
    const renderContentTokens = (content) => {
        const tokens = parseMarkdownTokens(content);
        return tokens.map((token, idx) => {
            switch (token.type) {
                case 'text':
                    return _jsx("span", { children: token.content }, idx);
                case 'bold':
                    return (_jsx("strong", { className: "font-bold text-white", children: token.content }, idx));
                case 'italic':
                    return (_jsx("em", { className: "italic text-slate-200", children: token.content }, idx));
                case 'strike':
                    return (_jsx("del", { className: "line-through text-slate-400", children: token.content }, idx));
                case 'code':
                    return (_jsx("code", { className: "rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-indigo-300 border border-slate-800", children: token.content }, idx));
                case 'codeblock':
                    return (_jsx("pre", { className: "my-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 shadow-inner", children: _jsx("code", { children: token.content }) }, idx));
                case 'spoiler': {
                    const isRevealed = Boolean(revealedSpoilers[idx]);
                    return (_jsx("span", { onClick: () => toggleSpoiler(idx), className: `rounded px-1.5 py-0.5 cursor-pointer text-xs transition-all ${isRevealed
                            ? 'bg-slate-800/80 text-slate-200 border border-slate-700/50'
                            : 'bg-slate-800 text-transparent hover:bg-slate-700/80 select-none'}`, title: isRevealed ? 'Gizlemek için tıkla' : "Spoiler'ı görmek için tıkla", children: token.content }, idx));
                }
                case 'mention': {
                    const lowerTarget = token.target.toLowerCase();
                    const isEveryone = lowerTarget === 'everyone' || lowerTarget === 'herkes' || lowerTarget === 'here';
                    const isMe = identity?.displayName && (token.target === identity.displayName || lowerTarget === identity.displayName.toLowerCase());
                    return (_jsxs("span", { className: `inline-flex items-center rounded px-1.5 py-0.5 font-semibold text-xs transition cursor-pointer ${isEveryone
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                            : isMe
                                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-600/40'
                                : 'bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 hover:text-white'}`, children: ["@", token.target] }, idx));
                }
                case 'link':
                    return (_jsx("a", { href: token.url, target: "_blank", rel: "noopener noreferrer", className: "text-indigo-400 underline hover:text-indigo-300 break-all", children: token.text }, idx));
                default:
                    return null;
            }
        });
    };
    // If message was deleted
    if (message.deleted) {
        return (_jsxs("div", { className: "flex items-start gap-3 -mx-4 px-4 py-1 rounded opacity-50 select-none", children: [_jsx("div", { className: "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-500 bg-slate-800", children: "?" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "text-xs font-semibold text-slate-500", children: message.authorName }), _jsx("span", { className: "text-[10px] text-slate-600", children: formatTime(message.createdAt) })] }), _jsx("p", { className: "mt-0.5 text-xs text-slate-500 italic", children: "[Bu mesaj silindi]" })] })] }));
    }
    const reactionsList = Object.entries(message.reactions ?? {}).filter(([, userIds]) => userIds.length > 0);
    if (message.authorId === 'system') {
        return (_jsxs("div", { className: "flex items-center gap-3 px-4 py-2.5 my-1.5 text-xs text-slate-300 bg-indigo-950/30 border-l-2 border-indigo-500 rounded-r shadow-sm", children: [_jsx("span", { className: "text-base", children: "\uD83C\uDF89" }), _jsx("div", { className: "flex-1 font-medium leading-relaxed text-slate-200", children: renderContentTokens(message.content) }), _jsx("span", { className: "text-[10px] text-slate-500 font-mono", children: formatTime(message.createdAt) })] }));
    }
    const isMentioned = Boolean(identity?.displayName &&
        (message.content.includes(`@${identity.displayName}`) ||
            message.content.toLowerCase().includes('@everyone') ||
            message.content.toLowerCase().includes('@herkes')));
    return (_jsxs("div", { className: `group relative flex items-start gap-3 -mx-4 px-4 py-1.5 rounded transition-colors ${isMentioned
            ? 'bg-indigo-950/25 border-l-2 border-indigo-500 hover:bg-indigo-950/40'
            : 'hover:bg-slate-800/40'}`, children: [_jsxs("div", { className: "absolute right-4 -top-3 z-20 hidden group-hover:flex items-center rounded-lg border border-slate-700/60 bg-slate-900 shadow-xl px-1 py-0.5 gap-0.5 text-slate-400", children: [_jsxs("div", { className: "relative", children: [_jsx("button", { onClick: () => setShowEmojiPicker(!showEmojiPicker), className: "rounded p-1 hover:bg-slate-800 hover:text-white transition", title: "Tepki Ekle", children: _jsx(Smile, { className: "h-4 w-4" }) }), showEmojiPicker && (_jsx("div", { className: "absolute right-0 top-8 z-30 flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl backdrop-blur-md", children: QUICK_EMOJIS.map((emoji) => (_jsx("button", { onClick: () => handleToggleReaction(emoji), className: "rounded-lg p-1.5 text-base hover:bg-slate-800 hover:scale-125 transition-transform", children: emoji }, emoji))) }))] }), _jsx("button", { onClick: () => setReplyingTo(message), className: "rounded p-1 hover:bg-slate-800 hover:text-white transition", title: "Yan\u0131tla", children: _jsx(CornerUpLeft, { className: "h-4 w-4" }) }), isAuthor && (_jsx("button", { onClick: () => {
                            setEditContent(message.content);
                            setIsEditing(true);
                        }, className: "rounded p-1 hover:bg-slate-800 hover:text-white transition", title: "D\u00FCzenle", children: _jsx(Pencil, { className: "h-4 w-4" }) })), canDelete && (_jsx("button", { onClick: () => wsService.deleteMessage(channelId, message.id), className: "rounded p-1 hover:bg-rose-950/60 hover:text-rose-400 transition", title: "Sil", children: _jsx(Trash2, { className: "h-4 w-4" }) }))] }), _jsx("div", { className: "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow select-none", style: { backgroundColor: avatarColor }, children: message.authorName.charAt(0).toUpperCase() }), _jsxs("div", { className: "flex-1 min-w-0", children: [message.replyTo && message.replyToAuthorName && (_jsxs("div", { className: "flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 select-none", children: [_jsx(CornerUpLeft, { className: "h-3.5 w-3.5 text-indigo-400" }), _jsxs("span", { className: "font-semibold text-indigo-300", children: ["@", message.replyToAuthorName] }), _jsx("span", { className: "truncate max-w-sm text-slate-500 italic", children: message.replyToContent })] })), _jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "text-xs font-bold text-white select-none", children: message.authorName }), _jsx("span", { className: "text-[10px] text-slate-500 select-none", children: formatTime(message.createdAt) }), message.editedAt && (_jsx("span", { className: "text-[10px] text-slate-500 italic select-none", title: "D\u00FCzenlendi", children: "(d\u00FCzenlendi)" }))] }), isEditing ? (_jsxs("div", { className: "mt-1 space-y-1", children: [_jsx("textarea", { value: editContent, onChange: (e) => setEditContent(e.target.value), onKeyDown: handleKeyDown, rows: 2, className: "w-full rounded-lg border border-indigo-500/60 bg-slate-950 p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans shadow-inner", autoFocus: true }), _jsxs("div", { className: "flex items-center gap-2 text-[11px] text-slate-400", children: [_jsxs("span", { children: ["Kaydetmek i\u00E7in ", _jsx("strong", { className: "text-white", children: "Enter" }), ", iptal i\u00E7in", ' ', _jsx("strong", { className: "text-white", children: "Esc" })] }), _jsxs("div", { className: "ml-auto flex items-center gap-1", children: [_jsx("button", { type: "button", onClick: handleCancelEdit, className: "rounded px-2 py-0.5 text-slate-400 hover:text-white", children: "\u0130ptal" }), _jsx("button", { type: "button", onClick: handleSaveEdit, className: "rounded bg-indigo-600 px-2 py-0.5 font-medium text-white hover:bg-indigo-500", children: "Kaydet" })] })] })] })) : (_jsx("div", { className: "mt-0.5 text-xs text-slate-200 break-words leading-relaxed select-text", children: message.content && renderContentTokens(message.content) })), message.attachments && message.attachments.length > 0 && (_jsx("div", { className: "mt-2 flex flex-col gap-2", children: message.attachments.map((att) => {
                            if (att.type === 'image' || att.type === 'gif') {
                                const imageUrl = att.url.startsWith('/') ? `${SERVER_HTTP_URL}${att.url}` : att.url;
                                return (_jsxs("button", { className: "relative max-w-sm overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/60 hover:border-indigo-500/50 transition cursor-zoom-in shadow group", onClick: () => setViewerImage({ url: imageUrl, name: att.name }), title: "B\u00FCy\u00FCtmek i\u00E7in t\u0131kla", children: [att.type === 'gif' && (_jsx("span", { className: "absolute top-1.5 left-1.5 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase", children: "GIF" })), _jsx("img", { src: imageUrl, alt: att.name, loading: "lazy", className: "max-h-72 w-auto object-contain rounded-xl group-hover:opacity-95 transition", style: { maxWidth: '100%' } })] }, att.id));
                            }
                            if (att.type === 'file' && att.p2pOffer) {
                                return (_jsx(P2PFileCard, { attachment: att, authorId: message.authorId, isAuthor: isAuthor }, att.id));
                            }
                            return null;
                        }) })), reactionsList.length > 0 && (_jsx("div", { className: "mt-1.5 flex flex-wrap gap-1.5 select-none", children: reactionsList.map(([emoji, userIds]) => {
                            const hasReacted = identity?.userId ? userIds.includes(identity.userId) : false;
                            return (_jsxs("button", { onClick: () => handleToggleReaction(emoji), className: `flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition border ${hasReacted
                                    ? 'bg-indigo-950/70 border-indigo-500/50 text-indigo-300 shadow-sm'
                                    : 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80'}`, title: `${userIds.length} kişi bu tepkiyi verdi`, children: [_jsx("span", { children: emoji }), _jsx("span", { className: "font-semibold text-[11px]", children: userIds.length })] }, emoji));
                        }) }))] }), viewerImage && (_jsx(ImageViewerModal, { imageUrl: viewerImage.url, imageName: viewerImage.name, onClose: () => setViewerImage(null) }))] }));
};
