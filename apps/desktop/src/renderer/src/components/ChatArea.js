import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Hash, Send, CornerUpLeft, X, Image, Paperclip, Users } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { wsService } from '../services/websocket';
import { ChatMessageItem } from './ChatMessageItem';
import { GiphyPicker } from './GiphyPicker';
import { uploadImageAttachment } from '../services/imageCompression';
import { p2pFileTransferService } from '../services/p2pFileTransfer';
import { SERVER_HTTP_URL } from '../config';
export const ChatArea = () => {
    const { identity } = useAuthStore();
    const { channels, activeChannelId, activeGroupId, messages, typingUsers, connectionStatus, members, replyingTo, setReplyingTo, } = useChatStore();
    const [inputContent, setInputContent] = useState('');
    const [stagedAttachments, setStagedAttachments] = useState([]);
    const [showGiphyPicker, setShowGiphyPicker] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showMentionPopup, setShowMentionPopup] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const dragCounterRef = useRef(0);
    const activeChannel = channels.find((c) => c.id === activeChannelId);
    const currentMessages = activeChannelId ? (messages[activeChannelId] ?? []) : [];
    const currentTyping = activeChannelId ? (typingUsers[activeChannelId] ?? []) : [];
    const myMember = members.find((m) => m.userId === identity?.userId);
    // Auto scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentMessages]);
    // Fetch channel history on channel change or connection
    useEffect(() => {
        if (activeChannelId && connectionStatus === 'connected') {
            wsService.fetchHistory(activeChannelId);
        }
    }, [activeChannelId, connectionStatus]);
    const handleUploadImage = useCallback(async (file) => {
        if (!activeGroupId)
            return;
        setIsUploading(true);
        try {
            const attachment = await uploadImageAttachment(activeGroupId, file);
            setStagedAttachments((prev) => [...prev, attachment]);
        }
        catch (err) {
            console.error('Image upload failed:', err);
            alert(`Görsel yüklenemedi: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
        }
        finally {
            setIsUploading(false);
        }
    }, [activeGroupId]);
    const handleUploadFile = useCallback(async (file) => {
        try {
            const attachment = await p2pFileTransferService.registerFileForSharing(file);
            setStagedAttachments((prev) => [...prev, attachment]);
        }
        catch (err) {
            console.error('P2P file register failed:', err);
        }
    }, []);
    const handleFiles = useCallback(async (files) => {
        const fileArray = Array.from(files);
        for (const file of fileArray) {
            if (file.type.startsWith('image/')) {
                await handleUploadImage(file);
            }
            else {
                await handleUploadFile(file);
            }
        }
    }, [handleUploadImage, handleUploadFile]);
    // Drag and drop handlers
    const handleDragEnter = (e) => {
        e.preventDefault();
        dragCounterRef.current++;
        setIsDraggingOver(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0)
            setIsDraggingOver(false);
    };
    const handleDragOver = (e) => {
        e.preventDefault();
    };
    const handleDrop = async (e) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDraggingOver(false);
        if (e.dataTransfer.files.length > 0) {
            await handleFiles(e.dataTransfer.files);
        }
    };
    // Clipboard paste (screenshots)
    useEffect(() => {
        const handlePaste = async (e) => {
            if (!activeChannelId)
                return;
            const items = e.clipboardData?.items;
            if (!items)
                return;
            const imageItems = Array.from(items).filter((item) => item.type.startsWith('image/'));
            for (const item of imageItems) {
                const file = item.getAsFile();
                if (file) {
                    await handleUploadImage(file);
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [activeChannelId, handleUploadImage]);
    const handleSendMessage = (e) => {
        if (e)
            e.preventDefault();
        if (!activeChannelId)
            return;
        if (!inputContent.trim() && stagedAttachments.length === 0)
            return;
        const content = inputContent;
        const replyId = replyingTo?.id;
        const attachments = [...stagedAttachments];
        setInputContent('');
        setStagedAttachments([]);
        setReplyingTo(null);
        wsService.sendMessage(activeChannelId, content, replyId, attachments);
        if (identity?.displayName) {
            useChatStore.setState((state) => {
                const current = state.typingUsers[activeChannelId] ?? [];
                return {
                    typingUsers: {
                        ...state.typingUsers,
                        [activeChannelId]: current.filter((n) => n !== identity.displayName),
                    },
                };
            });
        }
    };
    const mentionItems = useMemo(() => {
        if (!showMentionPopup)
            return [];
        const query = mentionQuery.toLowerCase();
        const items = [];
        if (!query || 'herkes'.includes(query) || 'everyone'.includes(query)) {
            items.push({
                id: 'everyone',
                displayName: 'herkes',
                subtitle: 'Bu kanaldaki herkese bildirim gönderir',
                isEveryone: true,
            });
        }
        const matchedMembers = members.filter((m) => m.displayName.toLowerCase().includes(query));
        for (const m of matchedMembers) {
            items.push({
                id: m.userId,
                displayName: m.displayName,
                subtitle: m.role === 'owner' ? 'Grup Kurucusu' : m.role === 'admin' ? 'Yönetici' : 'Üye',
            });
        }
        return items;
    }, [showMentionPopup, mentionQuery, members]);
    const insertMention = (item) => {
        if (!inputRef.current)
            return;
        const input = inputRef.current;
        const cursorPos = input.selectionStart ?? inputContent.length;
        const textBefore = inputContent.slice(0, cursorPos);
        const textAfter = inputContent.slice(cursorPos);
        const atMatch = textBefore.match(/(@([\p{L}\p{N}_-]*))$/u);
        if (atMatch) {
            const matchIndex = atMatch.index ?? 0;
            const mentionText = item.isEveryone ? '@herkes ' : `@${item.displayName} `;
            const newContent = textBefore.slice(0, matchIndex) + mentionText + textAfter;
            setInputContent(newContent);
            setShowMentionPopup(false);
            const newCursorPos = matchIndex + mentionText.length;
            setTimeout(() => {
                input.focus();
                input.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);
        }
    };
    const handleKeyDown = (e) => {
        if (showMentionPopup && mentionItems.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex((prev) => (prev + 1) % mentionItems.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex((prev) => (prev - 1 + mentionItems.length) % mentionItems.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const selected = mentionItems[mentionIndex];
                if (selected) {
                    insertMention(selected);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowMentionPopup(false);
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };
    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputContent(val);
        if (activeChannelId) {
            wsService.sendTyping(activeChannelId);
        }
        const cursorPos = e.target.selectionStart ?? val.length;
        const textBefore = val.slice(0, cursorPos);
        const atMatch = textBefore.match(/(@([\p{L}\p{N}_-]*))$/u);
        if (atMatch) {
            setShowMentionPopup(true);
            setMentionQuery(atMatch[2] ?? '');
            setMentionIndex(0);
        }
        else {
            setShowMentionPopup(false);
        }
    };
    const handleGifSelect = (gif) => {
        const gifAttachment = {
            id: `gif-${gif.id}`,
            name: gif.title || 'GIF',
            size: 0,
            mimeType: 'image/gif',
            url: gif.url,
            type: 'gif',
            width: gif.width,
            height: gif.height,
        };
        setStagedAttachments((prev) => [...prev, gifAttachment]);
        setShowGiphyPicker(false);
    };
    const removeStagedAttachment = (id) => {
        setStagedAttachments((prev) => prev.filter((a) => a.id !== id));
    };
    if (!activeChannel) {
        return (_jsx("div", { className: "flex flex-1 items-center justify-center bg-slate-900 text-slate-500", children: _jsxs("div", { className: "text-center", children: [_jsx(Hash, { className: "mx-auto h-12 w-12 opacity-40 mb-2" }), _jsx("p", { className: "text-sm", children: "Bir kanal se\u00E7in" })] }) }));
    }
    return (_jsxs("div", { className: "flex flex-1 flex-col h-full bg-slate-900 relative", onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDragOver: handleDragOver, onDrop: handleDrop, children: [isDraggingOver && (_jsxs("div", { className: "absolute inset-0 z-50 flex flex-col items-center justify-center bg-indigo-950/80 border-4 border-dashed border-indigo-400 rounded-xl m-2 pointer-events-none", children: [_jsx(Image, { className: "h-14 w-14 text-indigo-300 mb-3 opacity-90" }), _jsx("p", { className: "text-lg font-bold text-white", children: "Dosyay\u0131 buraya b\u0131rak" }), _jsx("p", { className: "text-sm text-indigo-300 mt-1", children: "G\u00F6rsel veya dosya y\u00FCklemek i\u00E7in" })] })), connectionStatus === 'connecting' && (_jsx("div", { className: "h-0.5 w-full bg-slate-800/80 overflow-hidden absolute top-0 left-0 right-0 z-10", children: _jsx("div", { className: "h-full w-1/3 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 rounded-full animate-indeterminate" }) })), _jsxs("div", { className: "flex h-14 items-center justify-between border-b border-slate-800/80 px-4 shadow-sm select-none", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Hash, { className: "h-5 w-5 text-slate-400" }), _jsx("span", { className: "font-bold text-white text-sm", children: activeChannel.name })] }), _jsxs("div", { className: "flex items-center gap-2", children: [connectionStatus === 'connected' && (_jsxs("div", { className: "flex items-center gap-2 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-400 shadow-sm", children: [_jsxs("span", { className: "relative flex h-2 w-2", children: [_jsx("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" }), _jsx("span", { className: "relative inline-flex h-2 w-2 rounded-full bg-emerald-500" })] }), _jsx("span", { className: "font-semibold text-[11px] tracking-wide", children: "Ba\u011Fl\u0131" }), _jsxs("div", { className: "flex items-end gap-0.5 ml-0.5 h-3", title: "Sinyal G\u00FCc\u00FC: M\u00FCkemmel", children: [_jsx("span", { className: "w-0.5 h-1.5 bg-emerald-400 rounded-full" }), _jsx("span", { className: "w-0.5 h-2.5 bg-emerald-400 rounded-full" }), _jsx("span", { className: "w-0.5 h-3.5 bg-emerald-400 rounded-full" })] })] })), connectionStatus === 'connecting' && (_jsxs("div", { className: "flex items-center gap-2 rounded-full bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 text-xs text-amber-400 shadow-sm", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-amber-400 animate-ping" }), _jsx("span", { className: "font-semibold text-[11px] tracking-wide", children: "Ba\u011Flan\u0131yor..." })] })), connectionStatus === 'disconnected' && (_jsxs("div", { className: "flex items-center gap-2 rounded-full bg-rose-950/60 border border-rose-500/30 px-2.5 py-1 text-xs text-rose-400 shadow-sm", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-rose-500" }), _jsx("span", { className: "font-semibold text-[11px] tracking-wide", children: "\u00C7evrimd\u0131\u015F\u0131" })] }))] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [currentMessages.length === 0 ? (_jsxs("div", { className: "flex h-full flex-col justify-end p-6 pb-8 select-none", children: [_jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700/60 text-white mb-4 shadow-lg shadow-slate-950/40", children: _jsx(Hash, { className: "h-9 w-9 text-indigo-400" }) }), _jsxs("h2", { className: "text-2xl font-black text-white tracking-tight mb-2", children: ["#", activeChannel.name, " kanal\u0131na ho\u015F geldin!"] }), _jsxs("p", { className: "text-xs text-slate-400 max-w-lg leading-relaxed", children: ["Buras\u0131 ", _jsxs("span", { className: "font-semibold text-slate-200", children: ["#", activeChannel.name] }), ' ', "kanal\u0131n\u0131n ba\u015Flang\u0131c\u0131. Arkada\u015Flar\u0131nla sohbet etmeye ba\u015Flamak i\u00E7in ilk mesaj\u0131 g\u00F6nder veya g\u00F6rsel payla\u015F!"] })] })) : (currentMessages.map((msg) => {
                        const member = members.find((m) => m.userId === msg.authorId);
                        return (_jsx(ChatMessageItem, { message: msg, channelId: activeChannel.id, member: member, currentUserRole: myMember?.role ?? 'member' }, msg.id));
                    })), _jsx("div", { ref: messagesEndRef })] }), _jsx("div", { className: "h-5 px-4 text-[11px] text-slate-400 italic flex items-center", children: currentTyping.length > 0 && (_jsxs("div", { className: "flex items-center gap-1.5 text-indigo-400/90 not-italic", children: [_jsxs("span", { className: "flex gap-0.5 items-center", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" }), _jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" }), _jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" })] }), _jsxs("span", { className: "text-[11px] font-medium text-slate-300", children: [currentTyping.join(', '), ' ', currentTyping.length === 1 ? 'yazıyor...' : 'yazıyorlar...'] })] })) }), _jsxs("div", { className: "p-4 pt-1 relative", children: [showMentionPopup && mentionItems.length > 0 && (_jsxs("div", { className: "absolute bottom-full left-4 right-4 mb-2 z-50 rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur-md shadow-2xl p-1.5 max-h-56 overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 mb-1", children: [_jsx("span", { children: "Etiketlenecek Ki\u015Fi veya Grup" }), _jsx("span", { className: "text-[9px] font-mono text-slate-500", children: "Tab / Enter ile se\u00E7" })] }), _jsx("div", { className: "space-y-0.5", children: mentionItems.map((item, idx) => {
                                    const isSelected = idx === mentionIndex;
                                    return (_jsxs("button", { type: "button", onClick: () => insertMention(item), onMouseEnter: () => setMentionIndex(idx), className: `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${isSelected
                                            ? 'bg-indigo-600/30 text-white font-medium border border-indigo-500/40'
                                            : 'text-slate-300 hover:bg-slate-900 border border-transparent'}`, children: [item.isEveryone ? (_jsx("div", { className: "flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0", children: _jsx(Users, { className: "h-4 w-4" }) })) : (_jsx("div", { className: "flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs shrink-0 shadow", children: item.displayName.charAt(0).toUpperCase() })), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "font-semibold truncate", children: item.isEveryone ? '@herkes' : `@${item.displayName}` }), item.isEveryone && (_jsx("span", { className: "rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/30", children: "Herkes" }))] }), item.subtitle && (_jsx("p", { className: "text-[10px] text-slate-400 truncate", children: item.subtitle }))] })] }, item.id));
                                }) })] })), showGiphyPicker && (_jsx(GiphyPicker, { onSelect: handleGifSelect, onClose: () => setShowGiphyPicker(false) })), replyingTo && (_jsxs("div", { className: "flex items-center justify-between rounded-t-lg border-t border-x border-slate-800 bg-slate-950/90 px-4 py-2 text-xs text-slate-300", children: [_jsxs("div", { className: "flex items-center gap-2 truncate", children: [_jsx(CornerUpLeft, { className: "h-3.5 w-3.5 text-indigo-400 flex-shrink-0" }), _jsxs("span", { children: [_jsxs("strong", { className: "text-white", children: ["@", replyingTo.authorName] }), " kullan\u0131c\u0131s\u0131na yan\u0131t veriliyor:"] }), _jsxs("span", { className: "truncate italic text-slate-400 max-w-sm", children: ["\"", replyingTo.content, "\""] })] }), _jsx("button", { type: "button", onClick: () => setReplyingTo(null), className: "ml-2 rounded p-1 text-slate-400 hover:text-white transition", title: "Yan\u0131t\u0131 \u0130ptal Et", children: _jsx(X, { className: "h-3.5 w-3.5" }) })] })), stagedAttachments.length > 0 && (_jsx("div", { className: `flex flex-wrap gap-2 rounded-t-lg border-t border-x border-slate-800 bg-slate-950/80 px-3 py-2 ${replyingTo ? '' : ''}`, children: stagedAttachments.map((att) => (_jsxs("div", { className: "relative group flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5", children: [att.type === 'image' || att.type === 'gif' ? (_jsx("img", { src: att.url.startsWith('/') ? `${SERVER_HTTP_URL}${att.url}` : att.url, alt: att.name, className: "h-10 w-10 object-cover rounded" })) : (_jsx("div", { className: "h-10 w-10 flex items-center justify-center rounded bg-indigo-600/20 border border-indigo-500/30", children: _jsx(Paperclip, { className: "h-5 w-5 text-indigo-400" }) })), _jsx("span", { className: "text-[10px] text-slate-300 max-w-[80px] truncate", children: att.name }), _jsx("button", { onClick: () => removeStagedAttachment(att.id), className: "absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition", children: _jsx(X, { className: "h-2.5 w-2.5" }) })] }, att.id))) })), _jsxs("form", { onSubmit: handleSendMessage, className: "relative flex items-center gap-2", children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", className: "hidden", onChange: async (e) => {
                                    if (e.target.files) {
                                        await handleFiles(e.target.files);
                                        e.target.value = '';
                                    }
                                } }), _jsx("button", { type: "button", onClick: () => fileInputRef.current?.click(), disabled: isUploading || connectionStatus !== 'connected', className: "flex-shrink-0 rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition disabled:opacity-40", title: "G\u00F6rsel Y\u00FCkle", children: isUploading ? (_jsxs("svg", { className: "h-4 w-4 animate-spin text-indigo-400", viewBox: "0 0 24 24", fill: "none", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })] })) : (_jsx(Image, { className: "h-4 w-4" })) }), _jsx("button", { type: "button", onClick: () => setShowGiphyPicker(!showGiphyPicker), disabled: connectionStatus !== 'connected', className: `flex-shrink-0 rounded-md px-2 py-1 text-xs font-bold transition disabled:opacity-40 ${showGiphyPicker
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-indigo-400'}`, title: "GIF Se\u00E7", children: "GIF" }), _jsxs("div", { className: "flex-1 relative", children: [_jsx("input", { ref: inputRef, type: "text", value: inputContent, onChange: handleInputChange, onKeyDown: handleKeyDown, placeholder: stagedAttachments.length > 0
                                            ? 'Mesaj ekle (isteğe bağlı)...'
                                            : `#${activeChannel.name} kanalına mesaj gönder`, className: `w-full border border-slate-800 bg-slate-950 px-4 py-3 pr-10 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none shadow-inner ${replyingTo || stagedAttachments.length > 0
                                            ? 'rounded-b-lg border-t-0'
                                            : 'rounded-lg'}` }), _jsx("button", { type: "submit", disabled: (!inputContent.trim() && stagedAttachments.length === 0) ||
                                            connectionStatus !== 'connected', className: "absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-indigo-400 transition hover:bg-slate-800 hover:text-indigo-300 disabled:opacity-40", children: _jsx(Send, { className: "h-4 w-4" }) })] })] })] })] }));
};
