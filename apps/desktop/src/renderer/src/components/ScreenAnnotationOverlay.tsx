import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Pen,
  ArrowRight,
  Square as RectIcon,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { AnnotationStroke, AnnotationPoint } from '@echo/shared';
import {
  useAnnotationStore,
  PRESET_COLORS,
} from '../stores/useAnnotationStore';
import { useAuthStore } from '../stores/useAuthStore';
import { wsService } from '../services/websocket';

interface Props {
  channelId: string;
  streamUserId: string;
  isLocal: boolean;
}

export const ScreenAnnotationOverlay: React.FC<Props> = ({
  channelId,
  streamUserId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    strokesByStream,
    activeTool,
    strokeColor,
    strokeWidth,
    isDrawingOpen,
    setTool,
    setColor,
    setWidth,
    setDrawingOpen,
    addStroke,
    undoLastStroke,
    clearStrokes,
  } = useAnnotationStore();

  const identity = useAuthStore((s) => s.identity);
  const strokes = strokesByStream[streamUserId] || [];

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<AnnotationPoint[]>([]);

  // Draw arrow helper
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    headLength = 14,
  ) => {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  };

  // Render all strokes onto canvas
  const renderStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const allStrokes = [...strokes];
    if (isDrawing && currentPoints.length > 0) {
      allStrokes.push({
        id: 'current_in_progress',
        userId: identity?.userId || 'me',
        userDisplayName: identity?.displayName || 'Ben',
        tool: activeTool,
        color: strokeColor,
        width: strokeWidth,
        points: currentPoints,
        timestamp: Date.now(),
      });
    }

    for (const stroke of allStrokes) {
      if (!stroke.points || stroke.points.length === 0) continue;

      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'pen') {
        ctx.beginPath();
        const startX = stroke.points[0]!.x * width;
        const startY = stroke.points[0]!.y * height;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i]!;
          ctx.lineTo(pt.x * width, pt.y * height);
        }
        ctx.stroke();
      } else if (stroke.tool === 'arrow') {
        const start = stroke.points[0]!;
        const end = stroke.points[stroke.points.length - 1]!;
        drawArrow(
          ctx,
          start.x * width,
          start.y * height,
          end.x * width,
          end.y * height,
          stroke.width * 4 + 8,
        );
      } else if (stroke.tool === 'rect') {
        const start = stroke.points[0]!;
        const end = stroke.points[stroke.points.length - 1]!;
        const x = Math.min(start.x, end.x) * width;
        const y = Math.min(start.y, end.y) * height;
        const w = Math.abs(end.x - start.x) * width;
        const h = Math.abs(end.y - start.y) * height;
        ctx.strokeRect(x, y, w, h);
      }

      ctx.restore();
    }
  }, [strokes, isDrawing, currentPoints, activeTool, strokeColor, strokeWidth, identity]);

  // Resize canvas to match display container
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        renderStrokes();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderStrokes]);

  useEffect(() => {
    renderStrokes();
  }, [renderStrokes]);

  // Mouse event handlers for drawing
  const getNormalizedPoint = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingOpen || e.button !== 0) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    setIsDrawing(true);
    setCurrentPoints([pt]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingOpen) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    if (activeTool === 'pen') {
      setCurrentPoints((prev) => [...prev, pt]);
    } else {
      // For arrow or rect, replace the end point
      setCurrentPoints((prev) => (prev.length > 0 ? [prev[0]!, pt] : [pt]));
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length > 0) {
      const stroke: AnnotationStroke = {
        id: `str_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: identity?.userId || 'unknown',
        userDisplayName: identity?.displayName || 'Kullanıcı',
        tool: activeTool,
        color: strokeColor,
        width: strokeWidth,
        points: currentPoints,
        timestamp: Date.now(),
      };

      addStroke(streamUserId, stroke);
      wsService.sendAnnotationStroke(channelId, streamUserId, stroke);
    }
    setCurrentPoints([]);
  };

  const handleClear = () => {
    clearStrokes(streamUserId);
    wsService.sendAnnotationClear(channelId, streamUserId);
  };

  const handleUndo = () => {
    undoLastStroke(streamUserId);
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-10 ${
        isDrawingOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full ${
          isDrawingOpen ? 'cursor-crosshair' : 'pointer-events-none'
        }`}
      />

      {/* Floating Drawing Toolbar (visible only when drawing mode is toggled on) */}
      {isDrawingOpen && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-slate-900/95 backdrop-blur-md px-3 py-2 border border-slate-700/80 shadow-2xl pointer-events-auto z-30 select-none animate-in fade-in zoom-in-95 duration-150">
          {/* Tool selection buttons */}
          <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2">
            <button
              type="button"
              onClick={() => setTool('pen')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                activeTool === 'pen'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Serbest Kalem"
            >
              <Pen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setTool('arrow')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                activeTool === 'arrow'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Yön Oku"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setTool('rect')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                activeTool === 'rect'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Dikdörtgen Çerçeve"
            >
              <RectIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-1.5 border-r border-slate-700/60 pr-2">
            {PRESET_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setColor(col)}
                className={`h-5 w-5 rounded-full transition-transform cursor-pointer ${
                  strokeColor === col ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: col }}
                title={col}
              />
            ))}
          </div>

          {/* Stroke width selector */}
          <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2">
            {[2, 4, 6].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWidth(w)}
                className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold transition cursor-pointer ${
                  strokeWidth === w
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={`Kalınlık: ${w}px`}
              >
                {w}
              </button>
            ))}
          </div>

          {/* Action buttons (Undo, Clear, Close) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Geri Al"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
              title="Tüm Çizimleri Temizle"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDrawingOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Çizim Aracını Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
