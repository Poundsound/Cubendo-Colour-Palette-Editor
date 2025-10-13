import { Draggable } from '@hello-pangea/dnd';
import { SwatchDisplay } from './SwatchDisplay';

export function DraggableRow({ rowIndex, rowId, colors, onSwatchClick, handleRemoveColor, onCopyColor, copiedIndex, columns, canDrag, showColorNames = false }) {
  return (
    <Draggable draggableId={rowId} index={rowIndex} type="ROW" isDragDisabled={!canDrag}>
      {(provided, snapshot) => {
        const style = {
          ...provided.draggableProps.style,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        };

        if (snapshot.isDragging) {
          style.background = '#252525';
          style.borderRadius = '8px';
          style.padding = '4px';
          style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.5)';
          style.animation = 'rowPulse 700ms ease-in-out infinite';
          style.willChange = 'background-color, box-shadow';
        }

        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`sortable-row ${snapshot.isDragging ? 'dragging' : ''}`}
            style={style}
          >
            <div
              {...provided.dragHandleProps}
              style={{
                cursor: canDrag ? 'grab' : 'not-allowed',
                padding: '8px',
                background: canDrag ? '#2a2a2a' : '#3a1f1f',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: canDrag ? '#888' : '#ff7777',
                fontWeight: 900,
                userSelect: 'none',
                flexShrink: 0,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!canDrag) return;
                e.currentTarget.style.background = '#333';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                if (!canDrag) return;
                e.currentTarget.style.background = '#2a2a2a';
                e.currentTarget.style.color = '#888';
              }}
              title={canDrag ? 'Drag to reorder entire row' : 'Add more colors to drag this row'}
            >
              {canDrag ? '⋮⋮' : '✕'}
            </div>
            <div style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: 8,
            }}>
              {colors.map((c) => (
                <SwatchDisplay
                  key={c.id}
                  id={c.id}
                  color={c.color}
                  showColorNames={showColorNames}
                  onRemove={handleRemoveColor}
                  onCopy={onCopyColor}
                  copied={copiedIndex === c.id}
                  onSwatchClick={onSwatchClick}
                  selected={false}
                  isDragging={false}
                  isRowDragging={snapshot.isDragging}
                />
              ))}
            </div>
          </div>
        );
      }}
    </Draggable>
  );
}
