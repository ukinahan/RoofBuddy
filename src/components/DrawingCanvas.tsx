import React, { useRef, useState } from 'react';
import { View, StyleSheet, GestureResponderEvent } from 'react-native';
import Svg, { Path, Rect, Circle, Line, Defs, Marker, Polygon, Text as SvgText } from 'react-native-svg';
import { DrawingPath, DrawingShape } from '../types';
import { formatLength, formatArea, Units } from '../services/locale';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  width: number;
  height: number;
  drawings: DrawingPath[];
  activeShape: DrawingShape;
  activeColor: string;
  strokeWidth: number;
  enabled: boolean;
  /** Pixels per metre for the photo, used to label measurements. */
  pixelsPerMeter?: number;
  /** Units to display measurement labels in. */
  units?: Units;
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

/** Encode a line as "x1,y1,x2,y2". Used for measure-line and calibration. */
function encodeLine(start: Point, end: Point): string {
  return `${start.x.toFixed(1)},${start.y.toFixed(1)},${end.x.toFixed(1)},${end.y.toFixed(1)}`;
}

function lineLengthPx(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function renderMeasurementLabel(
  cx: number,
  cy: number,
  text: string,
  color: string,
  key: string,
) {
  // RN-SVG doesn't support paint-order, so render the white halo first,
  // then the coloured fill on top to keep text readable on any background.
  return (
    <React.Fragment key={key}>
      <SvgText
        x={cx}
        y={cy}
        fontSize={14}
        fontWeight="bold"
        fill="white"
        stroke="white"
        strokeWidth={4}
        textAnchor="middle"
      >
        {text}
      </SvgText>
      <SvgText
        x={cx}
        y={cy}
        fontSize={14}
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
      >
        {text}
      </SvgText>
    </React.Fragment>
  );
}

function renderDrawing(
  d: DrawingPath,
  key: string,
  pixelsPerMeter?: number,
  units: Units = 'metric',
) {
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

  if (d.shape === 'measure-line') {
    const [x1, y1, x2, y2] = d.data.split(',').map(Number);
    const px = lineLengthPx(x1, y1, x2, y2);
    const label = pixelsPerMeter && pixelsPerMeter > 0
      ? formatLength(px / pixelsPerMeter, units)
      : `${px.toFixed(0)} px`;
    return (
      <React.Fragment key={key}>
        <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        {/* End-cap ticks perpendicular to line */}
        {(() => {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const tickLen = 8;
          const tx = Math.sin(angle) * tickLen;
          const ty = -Math.cos(angle) * tickLen;
          return (
            <>
              <Line x1={x1 - tx} y1={y1 - ty} x2={x1 + tx} y2={y1 + ty} stroke={color} strokeWidth={sw} />
              <Line x1={x2 - tx} y1={y2 - ty} x2={x2 + tx} y2={y2 + ty} stroke={color} strokeWidth={sw} />
            </>
          );
        })()}
        {renderMeasurementLabel((x1 + x2) / 2, (y1 + y2) / 2 - 8, label, color, `${key}-label`)}
      </React.Fragment>
    );
  }

  if (d.shape === 'measure-area') {
    const [x, y, w, h] = d.data.split(',').map(Number);
    let label: string;
    if (pixelsPerMeter && pixelsPerMeter > 0) {
      const wM = w / pixelsPerMeter;
      const hM = h / pixelsPerMeter;
      label = `${formatArea(wM * hM, units)} (${formatLength(wM, units)} \u00d7 ${formatLength(hM, units)})`;
    } else {
      label = `${(w * h).toFixed(0)} px\u00b2`;
    }
    return (
      <React.Fragment key={key}>
        <Rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth={sw} fill={color} fillOpacity={0.12} />
        {renderMeasurementLabel(x + w / 2, y + h / 2 + 4, label, color, `${key}-label`)}
      </React.Fragment>
    );
  }

  if (d.shape === 'calibration') {
    // data format: "x1,y1,x2,y2|metres"
    const [coords, metresStr] = d.data.split('|');
    const [x1, y1, x2, y2] = coords.split(',').map(Number);
    const metres = parseFloat(metresStr || '0');
    const label = metres > 0 ? formatLength(metres, units) : 'calibration';
    return (
      <React.Fragment key={key}>
        <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={sw} strokeDasharray="6,4" strokeLinecap="round" />
        {renderMeasurementLabel((x1 + x2) / 2, (y1 + y2) / 2 - 8, `\u{1F4D0} ${label}`, color, `${key}-label`)}
      </React.Fragment>
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
  pixelsPerMeter,
  units = 'metric',
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
    } else if (activeShape === 'measure-line' || activeShape === 'calibration') {
      const dist = Math.sqrt(Math.pow(liveEnd.x - liveStart.x, 2) + Math.pow(liveEnd.y - liveStart.y, 2));
      if (dist < 8) { setLivePoints([]); setLiveStart(null); setLiveEnd(null); return; }
      // For calibration we encode the metres separately later in PhotoDetail (it appends "|metres").
      data = encodeLine(liveStart, liveEnd);
    } else if (activeShape === 'measure-area') {
      const w = Math.abs(liveEnd.x - liveStart.x);
      const h = Math.abs(liveEnd.y - liveStart.y);
      if (w < 4 || h < 4) { setLivePoints([]); setLiveStart(null); setLiveEnd(null); return; }
      data = encodeRect(liveStart, liveEnd);
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
    if (activeShape === 'measure-line' || activeShape === 'calibration') {
      const px = lineLengthPx(liveStart.x, liveStart.y, liveEnd.x, liveEnd.y);
      const label = activeShape === 'measure-line' && pixelsPerMeter && pixelsPerMeter > 0
        ? formatLength(px / pixelsPerMeter, units)
        : `${px.toFixed(0)} px`;
      const dashed = activeShape === 'calibration' ? '6,4' : undefined;
      return (
        <>
          <Line x1={liveStart.x} y1={liveStart.y} x2={liveEnd.x} y2={liveEnd.y} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dashed} />
          {renderMeasurementLabel((liveStart.x + liveEnd.x) / 2, (liveStart.y + liveEnd.y) / 2 - 8, label, color, 'live-label')}
        </>
      );
    }
    if (activeShape === 'measure-area') {
      const x = Math.min(liveStart.x, liveEnd.x);
      const y = Math.min(liveStart.y, liveEnd.y);
      const w = Math.abs(liveEnd.x - liveStart.x);
      const h = Math.abs(liveEnd.y - liveStart.y);
      const label = pixelsPerMeter && pixelsPerMeter > 0
        ? formatArea((w / pixelsPerMeter) * (h / pixelsPerMeter), units)
        : `${(w * h).toFixed(0)} px\u00b2`;
      return (
        <>
          <Rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth={sw} fill={color} fillOpacity={0.12} strokeDasharray="6,3" />
          {renderMeasurementLabel(x + w / 2, y + h / 2 + 4, label, color, 'live-area-label')}
        </>
      );
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
        {drawings.map((d) => renderDrawing(d, d.id, pixelsPerMeter, units))}
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
