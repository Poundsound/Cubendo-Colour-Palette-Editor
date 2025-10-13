import { useEffect, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { SwatchDisplay } from './SwatchDisplay';

export function DraggableSwatchGrid({
  id,
  color,
  index,
  onRemove,
  onCopy,
  copied,
  onSwatchClick,
  selected,
  moveColor,
  draggingItemId,
  setDraggingItemId,
  onDragEnd,
  canDrag = true,
  showColorNames = false,
}) {
  const ref = useRef(null);

  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    type: 'SWATCH_GRID',
    item: () => {
      setDraggingItemId(id);
      return { id, index };
    },
    canDrag: () => !!canDrag,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      setDraggingItemId(null);
      onDragEnd();
    },
  }), [id, index, setDraggingItemId, onDragEnd, canDrag]);

  useEffect(() => {
    dragPreview(getEmptyImage(), { captureDraggingState: true });
  }, [dragPreview]);

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'SWATCH_GRID',
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
    hover: (item) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      moveColor(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  const isActiveDrag = isDragging || draggingItemId === id;

  return (
    <div
      ref={ref}
      style={{
        opacity: isActiveDrag ? 0.4 : 1,
        cursor: canDrag ? (isActiveDrag ? 'grabbing' : 'grab') : 'default',
        position: 'relative',
      }}
    >
      <SwatchDisplay
        id={id}
        color={color}
        showColorNames={showColorNames}
        onRemove={onRemove}
        onCopy={onCopy}
        copied={copied}
        onSwatchClick={onSwatchClick}
        selected={selected}
        isDragging={isActiveDrag}
        isHoverTarget={!isActiveDrag && isOver && canDrop}
        isRowDragging={false}
        canDrag={canDrag}
      />
    </div>
  );
}
