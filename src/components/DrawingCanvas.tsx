import React, { useRef, useState } from 'react';
import { View, StyleSheet, GestureResponderEvent } from 'react-native';
import Svg, { Path, Rect, Circle, Line, Defs, Marker, Polygon } from 'react-native-svg';
import { DrawingPath, DrawingShape } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  width: number;
  height: number;
  drawings: DrawingPath[];
  activeShape: DrawingShape;
  activeColor: string;
  strokeWidth: number;
  enabled: boolean;
  onDrawingAdded: (path: DrawingPath) => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
}

interface Point {
  x: number;
  y: number;
}

function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [start, ...rest] = points;
  const d = [`M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`];
  for (const p of rest) {
    d.push(`L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  return d.join(' ');
}

/** Encode rect as "x,y,w,h" */
function encodeRect(start: Point, end: Point): string {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  return `${x.toFixed(1)},${y.toFixed(1)},${w.toFixed(1)},${h.toFixed(1)}`;
}

/** Encode circle as "cx,cy,r" */
function encodeCircle(start: Point, end: Point): string {
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const r = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2;
  return `${cx.toFixed(1)},${cy.toFixed(1)},${r.toFixed(1)}`;
}

/** Encode arrow as "x1,y1,x2,y2" */
function encodeArrow(start: Point, end: Point): string {
  return `${start.x.toFixed(1)},${start.y.toFixed(1)},${end.x.toFixed(1)},${end.y.toFixed(1)}`;
}

function renderDrawing(d: DrawingPath, key: string) {
  const sw = d.strokeWidth;
  const color = d.color;

  if (d.shape === 'freehand') {
    return (
      <Path
        key={key}
        d={d.data}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }

  if (d.shape === 'rectangle') {
    const [x, y, w, h] = d.data.split(',').map(Number);
    return (
      <Rect
        key={key}
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={color}
        strokeWidth={sw}
        fill="none"
      />
    );
  }

  if (d.shape === 'circle') {
    const [cx, cy, r] = d.data.split(',').map(Number);
    return (
      <Circle
        key={key}
        cx={cx}
        cy={cy}
        r={r}
        stroke={color}
        strokeWidth={sw}
        fill="none"
      />
    );
  }

  if (d.shape === 'arrow') {
    const [x1, y1, x2, y2] = d.data.split(',').map(Number);
    // Compute arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(sw * 4, 14);
    const a1 = angle - Math.PI / 6;
    const a2 = angle + Math.PI / 6;
    const p1x = (x2 - headLen * Math.cos(a1)).toFixed(1);
    const p1y = (y2 - headLen * Math.sin(a1)).toFixed(1);
    const p2x = (x2 - headLen * Math.cos(a2)).toFixed(1);
    const p2y = (y2 - headLen * Math.sin(a2)).toFixed(1);
    const arrowPath = `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${p1x} ${p1y} M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${p2x} ${p2y}`;
    return (
      <Path
        key={key}
        d={arrowPath}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
    );
  }

  return null;
}

export default function DrawingCanvas({
  width,
  height,
  drawings,
  activeShape,
  activeColor,
  strokeWidth,
  enabled,
  onDrawingAdded,
  onDrawStart,
  onDrawEnd,
}: Props) {
  const [livePoints, setLivePoints] = useState<Point[]>([]);
  const [liveStart, setLiveStart] = useState<Point | null>(null);
  const [liveEnd, setLiveEnd] = useState<Point | null>(null);
  const isDrawing = useRef(false);

  const getPoint = (e: GestureResponderEvent): Point => ({
    x: e.nativeEvent.locationX,
    y: e.nativeEvent.locationY,
  });

  const onTouchStart = (e: GestureResponderEvent) => {
    if (!enabled) return;
    isDrawing.current = true;
    onDrawStart?.();
    const p = getPoint(e);
    setLiveStart(p);
    setLiveEnd(p);
    setLivePoints([p]);
  };

  const onTouchMove = (e: GestureResponderEvent) => {
    if (!enabled || !isDrawing.current) return;
    const p = getPoint(e);
    setLiveEnd(p);
    if (activeShape === 'freehand') {
      setLivePoints((prev) => [...prev, p]);
    }
  };

  const onTouchEnd = () => {
    if (!enabled || !isDrawing.current || !liveStart || !liveEnd) return;
    isDrawing.current = false;
    onDrawEnd?.();

    let data = '';
    if (activeShape === 'freehand') {
      data = pointsToSvgPath(livePoints);
      if (livePoints.length < 2) { setLivePoints([]); return; }
    } else if (activeShape === 'rectangle') {
      const w = Math.abs(liveEnd.x - liveStart.x);
      const h = Math.abs(liveEnd.y - liveStart.y);
      if (w < 4 || h < 4) { setLivePoints([]); setLiveStart(null); setLiveEnd(null); return; }
      data = encodeRect(liveStart, liveEnd);
    } else if (activeShape === 'circle') {
      const r = Math.sqrt(Math.pow(liveEnd.x - liveStart.x, 2) + Math.pow(liveEnd.y - liveStart.y, 2)) / 2;
      if (r < 4) { setLivePoints([]); setLiveStart(null); setLiveEnd(null); return; }
      data = encodeCircle(liveStart, liveEnd);
    } else if (activeShape === 'arrow') {
      const dist = Math.sqrt(Math.pow(liveEnd.x - liveStart.x, 2) + Math.pow(liveEnd.y - liveStart.y, 2));
      if (dist < 8) { setLivePoints([]); setLiveStart(null); setLiveEnd(null); return; }
      data = encodeArrow(liveStart, liveEnd);
    }

    const newPath: DrawingPath = {
      id: uuidv4(),
      shape: activeShape,
      data,
      color: activeColor,
      strokeWidth,
      createdAt: new Date().toISOString(),
    };

    onDrawingAdded(newPath);
    setLivePoints([]);
    setLiveStart(null);
    setLiveEnd(null);
  };

  // Live preview rendering
  const renderLivePreview = () => {
    if (!liveStart || !liveEnd) return null;
    const color = activeColor;
    const sw = strokeWidth;

    if (activeShape === 'freehand') {
      const d = pointsToSvgPath(livePoints);
      return <Path d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
    }
    if (activeShape === 'rectangle') {
      const x = Math.min(liveStart.x, liveEnd.x);
      const y = Math.min(liveStart.y, liveEnd.y);
      const w = Math.abs(liveEnd.x - liveStart.x);
      const h = Math.abs(liveEnd.y - liveStart.y);
      return <Rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth={sw} fill="none" strokeDasharray="6,3" />;
    }
    if (activeShape === 'circle') {
      const cx = (liveStart.x + liveEnd.x) / 2;
      const cy = (liveStart.y + liveEnd.y) / 2;
      const r = Math.sqrt(Math.pow(liveEnd.x - liveStart.x, 2) + Math.pow(liveEnd.y - liveStart.y, 2)) / 2;
      return <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={sw} fill="none" strokeDasharray="6,3" />;
    }
    if (activeShape === 'arrow') {
      const angle = Math.atan2(liveEnd.y - liveStart.y, liveEnd.x - liveStart.x);
      const headLen = Math.max(sw * 4, 14);
      const a1 = angle - Math.PI / 6;
      const a2 = angle + Math.PI / 6;
      const p1x = (liveEnd.x - headLen * Math.cos(a1)).toFixed(1);
      const p1y = (liveEnd.y - headLen * Math.sin(a1)).toFixed(1);
      const p2x = (liveEnd.x - headLen * Math.cos(a2)).toFixed(1);
      const p2y = (liveEnd.y - headLen * Math.sin(a2)).toFixed(1);
      const d = `M ${liveStart.x.toFixed(1)} ${liveStart.y.toFixed(1)} L ${liveEnd.x.toFixed(1)} ${liveEnd.y.toFixed(1)} M ${liveEnd.x.toFixed(1)} ${liveEnd.y.toFixed(1)} L ${p1x} ${p1y} M ${liveEnd.x.toFixed(1)} ${liveEnd.y.toFixed(1)} L ${p2x} ${p2y}`;
      return <Path d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />;
    }
    return null;
  };

  return (
    <View
      style={[styles.canvas, { width, height }]}
      pointerEvents={enabled ? 'auto' : 'none'}
      onStartShouldSetResponder={() => enabled}
      onMoveShouldSetResponder={() => enabled}
      onStartShouldSetResponderCapture={() => enabled}
      onMoveShouldSetResponderCapture={() => enabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onTouchStart}
      onResponderMove={onTouchMove}
      onResponderRelease={onTouchEnd}
      onResponderTerminate={onTouchEnd}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {drawings.map((d) => renderDrawing(d, d.id))}
        {renderLivePreview()}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
