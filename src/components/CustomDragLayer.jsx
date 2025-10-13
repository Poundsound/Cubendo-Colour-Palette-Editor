import { useDragLayer } from 'react-dnd';

export function CustomDragLayer({ colors }) {
  const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    currentOffset: monitor.getClientOffset(),
  }));

  if (!isDragging || !item || !currentOffset) {
    return null;
  }

  const active = (item.index != null && colors[item.index]) || colors.find((entry) => entry.id === item.id);
  const hex = active ? active.color : '#000000';

  const size = 64;
  const x = currentOffset.x - size / 2;
  const y = currentOffset.y - size / 2;

  return (
    <div style={{ position: 'fixed', pointerEvents: 'none', inset: 0, zIndex: 1500 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${x}px, ${y}px)`,
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            border: '2px solid #4a9eff',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
            background: hex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </div>
    </div>
  );
}
