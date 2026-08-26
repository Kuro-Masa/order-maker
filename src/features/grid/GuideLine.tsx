import { useEffect, useRef, useState, type PointerEvent } from "react";

export function GuideLine({
  center,
  top,
  height,
  isCenterLine = false,
  pos = 0,
  draggable = false,
  onDragEnd,
}: {
  center: number;
  top: number;
  height: number;
  isCenterLine?: boolean;
  pos?: number;
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

  return (
    <div
      ref={elRef}
      className={"guideLine guideLineV" + (isCenterLine ? " centerLine" : "") + (draggable ? " draggable" : "")}
      style={{ left, top, height }}
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
