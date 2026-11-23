export const directions = [
  [0, -1, '↑', '上'], [1, 0, '→', '右'], [0, 1, '↓', '下'], [-1, 0, '←', '左'],
];

export const arrowIndex = key => ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(key);
export const seconds = api => Math.max(1, Math.ceil(api.elapsed()));

export function element(parent, tag, className = '', content = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  parent.append(node);
  return node;
}

export function control(parent, api, label, action, className = 'sp-control') {
  const button = element(parent, 'button', className, label);
  button.type = 'button';
  button.addEventListener('click', action, { signal: api.signal });
  return button;
}

export function keyboard(node, api, action) {
  node.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (action(event.key, event)) event.preventDefault();
  }, { signal: api.signal });
}

export function grid(parent, api, columns, rows, label, action, className = '') {
  const board = element(parent, 'div', `x-grid sp-grid ${className}`);
  board.style.setProperty('--cols', columns);
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', label);
  const cells = Array.from({ length: columns * rows }, (_, i) => action
    ? control(board, api, '', () => action(i), 'sp-cell')
    : element(board, 'div', 'sp-cell'));
  if (!action) return { board, cells };
  keyboard(board, api, (key, event) => {
    const direction = arrowIndex(key);
    const position = cells.indexOf(event.target);
    if (direction < 0 || position < 0) return false;
    const [dx, dy] = directions[direction];
    let x = position % columns + dx;
    let y = Math.floor(position / columns) + dy;
    while (x >= 0 && y >= 0 && x < columns && y < rows) {
      const next = cells[y * columns + x];
      if (!next.disabled && !next.hidden) {
        next.focus({ preventScroll: true });
        break;
      }
      x += dx;
      y += dy;
    }
    return true;
  });
  return { board, cells };
}

export function position(node, x, y) {
  node.style.left = `${x}%`;
  node.style.top = `${y}%`;
}

export function canvas(parent, width, height, label) {
  const node = element(parent, 'canvas', 'sp-canvas');
  node.width = width;
  node.height = height;
  node.setAttribute('aria-label', label);
  return [node, node.getContext('2d')];
}

export function line(context, [x1, y1], [x2, y2], color, width = 1) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

export function labelCell(cell, index, columns, value) {
  cell.setAttribute('aria-label', `第 ${Math.floor(index / columns) + 1} 行第 ${index % columns + 1} 列，${value}`);
}
