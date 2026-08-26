export type BottomSheetSnap = 'collapsed' | 'closed' | 'expanded';

type ResolveBottomSheetSnapOptions = {
  collapsedOffset: number;
  position: number;
  velocityY: number;
};

export function resolveBottomSheetSnap({
  collapsedOffset,
  position,
  velocityY,
}: ResolveBottomSheetSnapOptions): BottomSheetSnap {
  'worklet';

  if (velocityY < -320) return 'expanded';
  if (velocityY > 1_100 || position > collapsedOffset + 110) return 'closed';
  if (velocityY > 320 || position > collapsedOffset * 0.5) return 'collapsed';
  return 'expanded';
}
