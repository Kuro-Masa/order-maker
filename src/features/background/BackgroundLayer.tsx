import { useEffect, useState } from "react";
import type { BackgroundData } from "../../types";
import { loadImage } from "./backgroundImage";

export function useBackgroundImage(imageId: string | undefined): { src: string | null; missing: boolean } {
  const [state, setState] = useState<{ id: string; src: string | null } | null>(null);
  useEffect(() => {
    if (!imageId) return;
    let alive = true;
    loadImage(imageId).then((src) => alive && setState({ id: imageId, src }));
    return () => {
      alive = false;
    };
  }, [imageId]);
  if (!imageId || state?.id !== imageId) return { src: null, missing: false };
  return { src: state.src, missing: state.src === null };
}

// The venue drawing under the grid, anchored to the grid's center axis and top edge
export function BackgroundLayer({
  bg,
  axis,
  top,
  active,
}: {
  bg: BackgroundData;
  axis: number; // x of the grid's center axis
  top: number; // y of the first row's top edge
  active: boolean;
}) {
  const { src } = useBackgroundImage(bg.imageId);
  if (!src) return null;
  return (
    <img
      className={"gridBackground" + (active ? " gridBackgroundActive" : "")}
      src={src}
      alt=""
      draggable={false}
      style={{
        left: axis + bg.x,
        top: top + bg.y,
        width: bg.width,
        height: bg.width * bg.aspect,
        opacity: bg.opacity,
      }}
    />
  );
}
