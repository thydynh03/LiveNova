'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api, uploadImage } from '../../lib/api-client';
import { Icon } from '../ui/Icon';
import { LoadingState } from '../common/States';

const STORAGE_KEY = 'livenova_vs_battle_setup_v5';

export function VsConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [battleOverlayToken, setBattleOverlayToken] = useState<string>('');
  
  const [goal, setGoal] = useState<number>(50);
  const [resetAfterMs, setResetAfterMs] = useState<number>(15000);
  const [splitPercent, setSplitPercent] = useState<number>(50);
  
  // Custom Names
  const [leftName, setLeftName] = useState<string>('RONALDO');
  const [rightName, setRightName] = useState<string>('MESSI');

  // Draggable Coordinates (in % of 1080x1920 canvas)
  const [leftNamePos, setLeftNamePos] = useState<{ x: number; y: number }>({ x: 8, y: 14 });
  const [rightNamePos, setRightNamePos] = useState<{ x: number; y: number }>({ x: 62, y: 14 });
  const [hudY, setHudY] = useState<number>(4); // Top progress bar Y %
  const [brickY, setBrickY] = useState<number>(88); // Bottom of brick stack Y %

  // Transform states for zoom & pan
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  
  // Active dragging item
  const [activeDrag, setActiveDrag] = useState<'image' | 'leftName' | 'rightName' | 'hud' | 'brick' | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; startValX: number; startValY: number }>({ x: 0, y: 0, startValX: 0, startValY: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string>('');

  // Draw 1080x1920 Canvas Preview
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgElementRef.current;
    if (!canvas || !img || !img.complete || !img.naturalWidth) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;

    // Fill solid black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const frameAspect = W / H;

    let baseW = W;
    let baseH = H;

    if (imgAspect > frameAspect) {
      baseW = W;
      baseH = W / imgAspect;
    } else {
      baseH = H;
      baseW = H * imgAspect;
    }

    const drawW = baseW * zoom;
    const drawH = baseH * zoom;
    const drawX = (W - drawW) / 2 + panX;
    const drawY = (H - drawH) / 2 + panY;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }, [zoom, panX, panY]);

  // Load saved state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedImage) {
          setSelectedImage(parsed.selectedImage);
          const img = new Image();
          img.onload = () => {
            imgElementRef.current = img;
            renderCanvas();
          };
          img.src = parsed.selectedImage;
        }
        if (parsed.finalUrl) setFinalUrl(parsed.finalUrl);
        if (typeof parsed.goal === 'number') setGoal(parsed.goal);
        if (typeof parsed.resetAfterMs === 'number') setResetAfterMs(parsed.resetAfterMs);
        if (typeof parsed.splitPercent === 'number') setSplitPercent(parsed.splitPercent);
        if (typeof parsed.zoom === 'number') setZoom(parsed.zoom);
        if (typeof parsed.panX === 'number') setPanX(parsed.panX);
        if (typeof parsed.panY === 'number') setPanY(parsed.panY);
        if (parsed.leftName) setLeftName(parsed.leftName);
        if (parsed.rightName) setRightName(parsed.rightName);
        if (parsed.leftNamePos) setLeftNamePos(parsed.leftNamePos);
        if (parsed.rightNamePos) setRightNamePos(parsed.rightNamePos);
        if (typeof parsed.hudY === 'number') setHudY(parsed.hudY);
        if (typeof parsed.brickY === 'number') setBrickY(parsed.brickY);
      }
    } catch (e) {
      console.warn('Failed to load saved VS setup:', e);
    }
  }, [renderCanvas]);

  useEffect(() => {
    if (selectedImage && imgElementRef.current) {
      renderCanvas();
    }
  }, [renderCanvas, selectedImage, zoom, panX, panY]);

  const saveState = useCallback((img: string | null, url: string, g: number, r: number, s: number, z: number, px: number, py: number, ln: string, rn: string, lnp: {x:number; y:number}, rnp: {x:number; y:number}, hy: number, by: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedImage: img,
        finalUrl: url,
        goal: g,
        resetAfterMs: r,
        splitPercent: s,
        zoom: z,
        panX: px,
        panY: py,
        leftName: ln,
        rightName: rn,
        leftNamePos: lnp,
        rightNamePos: rnp,
        hudY: hy,
        brickY: by,
      }));
    } catch (e) {
      console.warn('Failed to persist VS setup:', e);
    }
  }, []);

  const getOrCreateBattleToken = useCallback(async (): Promise<string> => {
    try {
      const overlays = await api.get<any>('/overlays');
      const list: Array<{ id: string; type: string; publicToken: string }> = Array.isArray(overlays)
        ? overlays
        : overlays?.data || [];

      let battle = list.find((o) => o.type === 'GAME_BATTLE');
      if (!battle) {
        battle = await api.post<any>('/overlays', {
          type: 'GAME_BATTLE',
          config: {},
        });
      }

      if (battle?.publicToken) {
        setBattleOverlayToken(battle.publicToken);
        return battle.publicToken;
      }
    } catch (err) {
      console.error('Failed to get/create battle overlay token:', err);
    }
    return '';
  }, []);

  useEffect(() => {
    getOrCreateBattleToken().finally(() => setLoading(false));
  }, [getOrCreateBattleToken]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      setFinalUrl('');
      setZoom(1);
      setPanX(0);
      setPanY(0);

      const img = new Image();
      img.onload = () => {
        imgElementRef.current = img;
        renderCanvas();
      };
      img.src = base64;

      saveState(base64, '', goal, resetAfterMs, splitPercent, 1, 0, 0, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    imgElementRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    setFinalUrl('');
    setZoom(1);
    setPanX(0);
    setPanY(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    saveState(null, '', goal, resetAfterMs, splitPercent, 1, 0, 0, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
  };

  const resetAllPositions = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setSplitPercent(50);
    setLeftNamePos({ x: 8, y: 14 });
    setRightNamePos({ x: 62, y: 14 });
    setHudY(4);
    setBrickY(88);
    saveState(selectedImage, finalUrl, goal, resetAfterMs, 50, 1, 0, 0, leftName, rightName, { x: 8, y: 14 }, { x: 62, y: 14 }, 4, 88);
  };

  // Start Dragging elements
  const startDrag = (item: 'image' | 'leftName' | 'rightName' | 'hud' | 'brick', e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDrag(item);
    if (item === 'image') {
      dragStartRef.current = { x: e.clientX, y: e.clientY, startValX: panX, startValY: panY };
    } else if (item === 'leftName') {
      dragStartRef.current = { x: e.clientX, y: e.clientY, startValX: leftNamePos.x, startValY: leftNamePos.y };
    } else if (item === 'rightName') {
      dragStartRef.current = { x: e.clientX, y: e.clientY, startValX: rightNamePos.x, startValY: rightNamePos.y };
    } else if (item === 'hud') {
      dragStartRef.current = { x: e.clientX, y: e.clientY, startValX: 0, startValY: hudY };
    } else if (item === 'brick') {
      dragStartRef.current = { x: e.clientX, y: e.clientY, startValX: 0, startValY: brickY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag) return;
    const frame = previewFrameRef.current;
    if (!frame) return;

    const frameW = frame.clientWidth;
    const frameH = frame.clientHeight;
    const dxPx = e.clientX - dragStartRef.current.x;
    const dyPx = e.clientY - dragStartRef.current.y;
    const dxPct = (dxPx / frameW) * 100;
    const dyPct = (dyPx / frameH) * 100;

    if (activeDrag === 'image') {
      const scaleFactor = 1080 / frameW;
      setPanX(dragStartRef.current.startValX + dxPx * scaleFactor);
      setPanY(dragStartRef.current.startValY + dyPx * scaleFactor);
    } else if (activeDrag === 'leftName') {
      const newX = Math.max(2, Math.min(45, Number((dragStartRef.current.startValX + dxPct).toFixed(1))));
      const newY = Math.max(2, Math.min(90, Number((dragStartRef.current.startValY + dyPct).toFixed(1))));
      setLeftNamePos({ x: newX, y: newY });
    } else if (activeDrag === 'rightName') {
      const newX = Math.max(52, Math.min(85, Number((dragStartRef.current.startValX + dxPct).toFixed(1))));
      const newY = Math.max(2, Math.min(90, Number((dragStartRef.current.startValY + dyPct).toFixed(1))));
      setRightNamePos({ x: newX, y: newY });
    } else if (activeDrag === 'hud') {
      const newY = Math.max(2, Math.min(88, Number((dragStartRef.current.startValY + dyPct).toFixed(1))));
      setHudY(newY);
    } else if (activeDrag === 'brick') {
      const newY = Math.max(30, Math.min(96, Number((dragStartRef.current.startValY + dyPct).toFixed(1))));
      setBrickY(newY);
    }
  };

  const handleMouseUp = () => {
    if (activeDrag) {
      setActiveDrag(null);
      saveState(selectedImage, finalUrl, goal, resetAfterMs, splitPercent, zoom, panX, panY, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    const newZoom = Math.min(3, Math.max(0.4, Number((zoom + delta).toFixed(2))));
    setZoom(newZoom);
    saveState(selectedImage, finalUrl, goal, resetAfterMs, splitPercent, newZoom, panX, panY, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
  };

  const handleGenerate = async () => {
    const masterCanvas = canvasRef.current;
    if (!selectedImage || !masterCanvas) {
      alert('Vui lòng tải lên một bức ảnh!');
      return;
    }
    
    setSaving(true);
    try {
      let token = battleOverlayToken;
      if (!token) {
        token = await getOrCreateBattleToken();
      }

      if (!token) {
        alert('Không thể khởi tạo mã Overlay. Vui lòng thử tải lại trang hoặc kiểm tra đăng nhập!');
        setSaving(false);
        return;
      }

      // Re-render canvas
      renderCanvas();

      const TARGET_W = 1080;
      const TARGET_H = 1920;
      const splitX = Math.round((TARGET_W * splitPercent) / 100);

      // 1. Crop Left Side
      const canvasLeft = document.createElement('canvas');
      canvasLeft.width = splitX;
      canvasLeft.height = TARGET_H;
      const ctxLeft = canvasLeft.getContext('2d')!;
      ctxLeft.drawImage(masterCanvas, 0, 0, splitX, TARGET_H, 0, 0, splitX, TARGET_H);

      // 2. Crop Right Side
      const canvasRight = document.createElement('canvas');
      canvasRight.width = TARGET_W - splitX;
      canvasRight.height = TARGET_H;
      const ctxRight = canvasRight.getContext('2d')!;
      ctxRight.drawImage(masterCanvas, splitX, 0, TARGET_W - splitX, TARGET_H, 0, 0, TARGET_W - splitX, TARGET_H);

      const blobLeft = await new Promise<Blob>((res) => canvasLeft.toBlob((b) => res(b!), 'image/png'));
      const blobRight = await new Promise<Blob>((res) => canvasRight.toBlob((b) => res(b!), 'image/png'));

      const fileLeft = new File([blobLeft], 'left-half.png', { type: 'image/png' });
      const fileRight = new File([blobRight], 'right-half.png', { type: 'image/png' });

      const [resLeft, resRight] = await Promise.all([
        uploadImage(fileLeft),
        uploadImage(fileRight),
      ]);

      let origin = window.location.origin;
      if (process.env.NEXT_PUBLIC_OVERLAY_URL) {
        origin = process.env.NEXT_PUBLIC_OVERLAY_URL.replace(/\/$/, '');
      }

      const overlayUrl = `${origin}/overlays/battle?token=${token}&goal=${goal}&resetAfterMs=${resetAfterMs}&leftName=${encodeURIComponent(leftName)}&rightName=${encodeURIComponent(rightName)}&leftNameX=${leftNamePos.x}&leftNameY=${leftNamePos.y}&rightNameX=${rightNamePos.x}&rightNameY=${rightNamePos.y}&hudY=${hudY}&brickY=${brickY}&ronaldoImg=${encodeURIComponent(resLeft.url)}&messiImg=${encodeURIComponent(resRight.url)}`;

      setFinalUrl(overlayUrl);
      saveState(selectedImage, overlayUrl, goal, resetAfterMs, splitPercent, zoom, panX, panY, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
    } catch (err: any) {
      console.error(err);
      alert('Có lỗi xảy ra khi xử lý ảnh: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(finalUrl);
    alert('Đã sao chép liên kết Overlay!');
  };

  if (loading) return <LoadingState />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⚔️</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'hsl(var(--foreground))' }}>
            Cấu hình Trận Đấu Đặt Gạch (VS)
          </h2>
        </div>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
          <strong>Kéo thả tự do</strong> Tên 2 phe, Bảng điểm tiến độ và Cột gạch đến bất kỳ vị trí nào trên màn hình!
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {/* Step 1: WYSIWYG Interactive Drag & Drop Studio */}
        <div style={{ padding: '1.25rem', background: 'hsl(var(--background))', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'hsl(var(--foreground))' }}>
              1. Studio Kéo Thả Trực Quan 1080 × 1920
            </h3>
            <span style={{ fontSize: '0.72rem', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', padding: '2px 8px', borderRadius: '4px', color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>
              Kéo thả mọi phần tử
            </span>
          </div>

          <input type="file" accept="image/*" onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }} onChange={handleImageSelect} ref={fileInputRef} style={{ display: 'none' }} />
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()} 
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.9rem', 
                background: 'hsl(var(--primary))', 
                color: 'hsl(var(--primary-foreground))', 
                borderRadius: 'var(--radius)', 
                fontWeight: 600, 
                fontSize: '0.82rem',
                border: 'none', 
                cursor: 'pointer' 
              }}
            >
              <Icon name="upload" size={15} /> 
              <span>{selectedImage ? 'Đổi ảnh khác' : 'Tải ảnh lên'}</span>
            </button>

            {selectedImage && (
              <>
                <button 
                  type="button"
                  onClick={resetAllPositions}
                  title="Đặt lại toàn bộ vị trí về mặc định"
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.75rem', 
                    background: 'hsl(var(--card))', 
                    color: 'hsl(var(--foreground))', 
                    borderRadius: 'var(--radius)', 
                    fontWeight: 600, 
                    fontSize: '0.82rem',
                    border: '1px solid hsl(var(--border))', 
                    cursor: 'pointer' 
                  }}
                >
                  <Icon name="rotate" size={14} />
                  <span>Căn lại mặc định</span>
                </button>

                <button 
                  type="button"
                  onClick={handleClearImage}
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.75rem', 
                    background: 'hsl(var(--card))', 
                    color: '#ef4444', 
                    borderRadius: 'var(--radius)', 
                    fontWeight: 600, 
                    fontSize: '0.82rem',
                    border: '1px solid #ef444444', 
                    cursor: 'pointer' 
                  }}
                >
                  <Icon name="trash" size={14} />
                  <span>Xóa ảnh</span>
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* WYSIWYG Interactive 1080x1920 Frame with Draggable UI Widgets */}
            <div 
              ref={previewFrameRef}
              onMouseDown={(e) => startDrag('image', e)}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              style={{ 
                position: 'relative', 
                width: '100%', 
                maxWidth: '280px', 
                aspectRatio: '9 / 16', 
                margin: '0 auto', 
                background: '#000000', 
                borderRadius: 'var(--radius)', 
                border: '2px solid hsl(var(--primary) / 0.7)', 
                overflow: 'hidden', 
                boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
                cursor: selectedImage ? (activeDrag === 'image' ? 'grabbing' : 'grab') : 'default',
                userSelect: 'none',
                touchAction: 'none'
              }}
            >
              <canvas 
                ref={canvasRef} 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  display: selectedImage ? 'block' : 'none',
                  objectFit: 'contain',
                  pointerEvents: 'none'
                }} 
              />

              {!selectedImage && (
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  style={{ 
                    position: 'absolute',
                    inset: 0,
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem', 
                    color: 'hsl(var(--muted-foreground))', 
                    cursor: 'pointer',
                    background: '#09090b',
                    padding: '1rem',
                    textAlign: 'center'
                  }}
                >
                  <Icon name="upload" size={32} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Bấm để tải ảnh 2 nhân vật</span>
                  <span style={{ fontSize: '0.72rem' }}>Kéo chuột di chuyển • Cuộn để zoom</span>
                </div>
              )}

              {selectedImage && (
                <>
                  {/* Vertical Split Line Indicator */}
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      bottom: 0, 
                      left: `${splitPercent}%`, 
                      width: '2px', 
                      background: '#ffffff', 
                      boxShadow: '0 0 10px #ffffff, 0 0 6px #ffcc00', 
                      transform: 'translateX(-50%)', 
                      zIndex: 10,
                      pointerEvents: 'none'
                    }} 
                  />

                  {/* 1. DRAGGABLE HUD BẢNG ĐIỂM (TIẾN ĐỘ) */}
                  <div 
                    onMouseDown={(e) => startDrag('hud', e)}
                    title="Bấm giữ kéo lên/xuống để đổi vị trí Bảng điểm"
                    style={{ 
                      position: 'absolute', 
                      top: `${hudY}%`, 
                      left: '8px', 
                      right: '8px', 
                      background: 'rgba(0,0,0,0.85)', 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      border: '1px dashed #ffd700', 
                      cursor: 'ns-resize', 
                      zIndex: 30,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.8)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 800, marginBottom: '2px' }}>
                      <span style={{ color: '#ff4444' }}>🔴 0/{goal}</span>
                      <span style={{ color: '#ffd700', fontSize: '8px' }}>↕️ Bảng Điểm (Kéo)</span>
                      <span style={{ color: '#3b82f6' }}>0/{goal} 🔵</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: '40%', height: '100%', background: '#ff4444' }}/>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: '60%', height: '100%', background: '#3b82f6' }}/>
                      </div>
                    </div>
                  </div>

                  {/* 2. DRAGGABLE TÊN PHE TRÁI (RONALDO) */}
                  <div 
                    onMouseDown={(e) => startDrag('leftName', e)}
                    title="Bấm giữ để kéo tên Ronaldo đến vị trí bất kỳ"
                    style={{ 
                      position: 'absolute', 
                      top: `${leftNamePos.y}%`, 
                      left: `${leftNamePos.x}%`, 
                      background: 'rgba(239, 68, 68, 0.9)', 
                      color: '#fff', 
                      padding: '3px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.72rem', 
                      fontWeight: 900, 
                      cursor: 'move', 
                      zIndex: 35,
                      border: '1px solid #ffffff',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.6)'
                    }}
                  >
                    ✋ {leftName || 'Phe Đỏ'}
                  </div>

                  {/* 3. DRAGGABLE TÊN PHE PHẢI (MESSI) */}
                  <div 
                    onMouseDown={(e) => startDrag('rightName', e)}
                    title="Bấm giữ để kéo tên Messi đến vị trí bất kỳ"
                    style={{ 
                      position: 'absolute', 
                      top: `${rightNamePos.y}%`, 
                      left: `${rightNamePos.x}%`, 
                      background: 'rgba(59, 130, 246, 0.9)', 
                      color: '#fff', 
                      padding: '3px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.72rem', 
                      fontWeight: 900, 
                      cursor: 'move', 
                      zIndex: 35,
                      border: '1px solid #ffffff',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.6)'
                    }}
                  >
                    ✋ {rightName || 'Phe Xanh'}
                  </div>

                  {/* 4. DRAGGABLE CỘT GẠCH MẪU */}
                  <div 
                    onMouseDown={(e) => startDrag('brick', e)}
                    title="Bấm giữ kéo để chọn độ cao đáy đặt gạch"
                    style={{ 
                      position: 'absolute', 
                      top: `${brickY - 14}%`, 
                      left: '10px', 
                      right: '10px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      zIndex: 30,
                      cursor: 'ns-resize'
                    }}
                  >
                    <div style={{ background: 'rgba(255, 68, 68, 0.85)', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', color: '#fff', fontWeight: 800, border: '1px dashed #fff' }}>
                      🧱 Cột Gạch Đỏ
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.85)', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', color: '#fff', fontWeight: 800, border: '1px dashed #fff' }}>
                      🧱 Cột Gạch Xanh
                    </div>
                  </div>

                  {/* Helper hint */}
                  <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'rgba(255,255,255,0.9)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 700, pointerEvents: 'none', zIndex: 25, whiteSpace: 'nowrap' }}>
                    💡 Bấm kéo trực tiếp Tên / Bảng điểm / Gạch
                  </div>
                </>
              )}
            </div>

            {selectedImage && (
              <div style={{ background: 'hsl(var(--card))', padding: '0.85rem', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* 1. Zoom Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      🔍 Phóng to / Thu nhỏ ảnh:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button 
                        type="button" 
                        onClick={() => {
                          const nz = Math.max(0.4, Number((zoom - 0.1).toFixed(2)));
                          setZoom(nz);
                          saveState(selectedImage, finalUrl, goal, resetAfterMs, splitPercent, nz, panX, panY, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
                        }}
                        style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'inherit', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem' }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'hsl(var(--primary))', minWidth: '45px', textAlign: 'center' }}>
                        {Math.round(zoom * 100)}%
                      </span>
                      <button 
                        type="button" 
                        onClick={() => {
                          const nz = Math.min(3, Number((zoom + 0.1).toFixed(2)));
                          setZoom(nz);
                          saveState(selectedImage, finalUrl, goal, resetAfterMs, splitPercent, nz, panX, panY, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
                        }}
                        style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'inherit', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0.4" 
                    max="3" 
                    step="0.05"
                    value={zoom} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setZoom(val);
                      saveState(selectedImage, finalUrl, goal, resetAfterMs, splitPercent, val, panX, panY, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
                    }} 
                    style={{ width: '100%', cursor: 'pointer', accentColor: 'hsl(var(--primary))' }} 
                  />
                </div>

                {/* 2. Split Line Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                      📏 Vạch chia 2 phe:
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'hsl(var(--primary))' }}>
                      {splitPercent}% : {100 - splitPercent}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="20" 
                    max="80" 
                    value={splitPercent} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSplitPercent(val);
                      saveState(selectedImage, finalUrl, goal, resetAfterMs, val, zoom, panX, panY, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
                    }} 
                    style={{ width: '100%', cursor: 'pointer', accentColor: 'hsl(var(--primary))' }} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Settings & Action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '1.25rem', background: 'hsl(var(--background))', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'hsl(var(--foreground))' }}>
              2. Đặt Tên & Thông Số Trận Đấu
            </h3>

            {/* Custom Team Names */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.25rem' }}>
                  🔴 Tên Phe Trái
                </label>
                <input 
                  type="text" 
                  value={leftName} 
                  onChange={(e) => {
                    setLeftName(e.target.value);
                    saveState(selectedImage, finalUrl, goal, resetAfterMs, splitPercent, zoom, panX, panY, e.target.value, rightName, leftNamePos, rightNamePos, hudY, brickY);
                  }}
                  placeholder="RONALDO"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'inherit', fontSize: '0.85rem', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#3b82f6', marginBottom: '0.25rem' }}>
                  🔵 Tên Phe Phải
                </label>
                <input 
                  type="text" 
                  value={rightName} 
                  onChange={(e) => {
                    setRightName(e.target.value);
                    saveState(selectedImage, finalUrl, goal, resetAfterMs, splitPercent, zoom, panX, panY, leftName, e.target.value, leftNamePos, rightNamePos, hudY, brickY);
                  }}
                  placeholder="MESSI"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'inherit', fontSize: '0.85rem', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Goal & Reset */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem', color: 'hsl(var(--muted-foreground))' }}>
                  Mốc chiến thắng (Goal)
                </label>
                <input 
                  type="number" 
                  value={goal} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setGoal(val);
                    saveState(selectedImage, finalUrl, val, resetAfterMs, splitPercent, zoom, panX, panY, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
                  }} 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'inherit', fontSize: '0.85rem' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem', color: 'hsl(var(--muted-foreground))' }}>
                  Tự reset sau thắng (ms)
                </label>
                <input 
                  type="number" 
                  value={resetAfterMs} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setResetAfterMs(val);
                    saveState(selectedImage, finalUrl, goal, val, splitPercent, zoom, panX, panY, leftName, rightName, leftNamePos, rightNamePos, hudY, brickY);
                  }} 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'inherit', fontSize: '0.85rem' }} 
                />
              </div>
            </div>
            
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.4 }}>
              💡 <strong>Cách kéo thả:</strong> Trên khung hình bên trái, bạn có thể click giữ chuột để kéo <strong>Tên Ronaldo</strong>, <strong>Tên Messi</strong>, <strong>Bảng điểm</strong> và <strong>Cột gạch</strong> đến bất cứ góc nào!
            </div>
          </div>

          <button 
            type="button"
            onClick={handleGenerate} 
            disabled={saving || !selectedImage} 
            style={{ 
              padding: '0.875rem 1rem', 
              background: saving || !selectedImage ? 'hsl(var(--muted))' : 'linear-gradient(135deg, hsl(var(--primary)), #ec4899)', 
              color: saving || !selectedImage ? 'hsl(var(--muted-foreground))' : '#ffffff', 
              borderRadius: 'var(--radius)', 
              fontWeight: 700, 
              border: 'none', 
              cursor: saving || !selectedImage ? 'not-allowed' : 'pointer', 
              fontSize: '0.95rem',
              boxShadow: saving || !selectedImage ? 'none' : '0 4px 14px hsl(var(--primary) / 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            {saving ? 'Đang căn chỉnh & xuất ảnh...' : '✨ Cắt chuẩn 1080x1920 & Xuất link Overlay'}
          </button>

          {/* Generated URL Result Box */}
          {finalUrl && (
            <div style={{ padding: '1.25rem', background: 'hsl(var(--accent-surface))', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--primary) / 0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Icon name="check" size={18} style={{ color: 'hsl(var(--primary))' }} />
                <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--primary-hover))' }}>
                  Link Overlay Đã Sẵn Sàng!
                </strong>
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                Dán link này vào TikTok Live Studio (Web Source) độ phân giải <strong>1080 × 1920</strong>:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={finalUrl} 
                  style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'inherit', fontFamily: 'monospace', fontSize: '0.78rem' }} 
                />
                <button 
                  type="button"
                  onClick={copyToClipboard}
                  style={{ padding: '0.5rem 1rem', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                >
                  Sao chép
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
