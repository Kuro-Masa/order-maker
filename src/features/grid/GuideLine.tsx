import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { radialLine, type RadialFrame } from "../../state/curve";

export function GuideLine({
  center,
  top,
  height,
  isCenterLine = false,
  pos = 0,
  angle = 0,
  radial,
  draggable = false,
  onDragEnd,
}: {
  center: number;
  top: number;
  height: number;
  isCenterLine?: boolean;
  pos?: number;
  angle?: number;
  radial?: RadialFrame; // set when rows are curved: the line runs along a radius
  draggable?: boolean;
  onDragEnd?: (newPos: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startClientXRef = useRef(0);
  const startPosRef = useRef(0);
  const [dragPos, setDragPos] = useState(pos);

  useEffect(() => {
    setDragPos(pos);
  }, [pos]);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!draggable) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    startClientXRef.current = e.clientX;
    startPosRef.current = dragPos;
    elRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setDragPos(startPosRef.current + (e.clientX - startClientXRef.current));
  }

  function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const rounded = Math.round(dragPos);
    setDragPos(rounded);
    onDragEnd?.(rounded);
  }

  const left = center + (isCenterLine ? 0 : dragPos);
  let style: CSSProperties = {
    left,
    top,
    height,
    ...(angle ? { transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 100%" } : {}),
  };
  if (radial) {
    const l = radialLine(radial, isCenterLine ? 0 : dragPos, isCenterLine ? 0 : angle);
    style = {
      left: l.x,
      top: l.y - l.length,
      height: l.length,
      transform: `translateX(-50%) rotate(${l.angle}rad)`,
      transformOrigin: "50% 100%",
    };
  }

  return (
    <div
      ref={elRef}
      className={"guideLine guideLineV" + (isCenterLine ? " centerLine" : "") + (draggable ? " draggable" : "")}
      style={style}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="lineStrip" />
    </div>
  );
}
