export const directions = [
  { dx: 0, dy: -1, arrow: '↑', label: '向上' },
  { dx: 1, dy: 0, arrow: '→', label: '向右' },
  { dx: 0, dy: 1, arrow: '↓', label: '向下' },
  { dx: -1, dy: 0, arrow: '←', label: '向左' },
];

export function element(parent, tag, className = '', content = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  parent.append(node);
  return node;
}

export function setup(host, api, type) {
  const root = document.createElement('div');
  root.className = `strategy-game strategy-${type}`;
  host.replaceChildren(root);
  const stats = element(root, 'div', 'x-toolbar strategy-stats');
  let finished = false;
  return {
    root,
    signal: api.signal,
    status(message) {
      api.status(message);
    },
    stats(values) {
      stats.replaceChildren(...values.map(value => {
        const chip = document.createElement('span');
        chip.textContent = value;
        return chip;
      }));
    },
    button(parent, label, run, className = '') {
      const button = element(parent, 'button', className, label);
      button.type = 'button';
      button.addEventListener('click', () => {
        if (!finished && !api.signal.aborted) run();
      }, { signal: api.signal });
      return button;
    },
    end(message, metric = null) {
      if (finished || api.signal.aborted) return;
      finished = true;
      for (const control of root.querySelectorAll('button')) control.disabled = true;
      api.end(message, metric);
    },
  };
}

export function makeBoard(view, parent, width, height, name, choose) {
  const board = element(parent, 'div', 'x-grid strategy-board');
  board.style.setProperty('--cols', width);
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', name);
  const cells = Array.from({ length: width * height }, (_, index) => {
    return choose
      ? view.button(board, '', () => choose(index), 'strategy-cell')
      : element(board, 'div', 'strategy-cell');
  });
  if (choose) {
    board.addEventListener('keydown', event => {
      const direction = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(event.key);
      const source = cells.indexOf(event.target);
      if (direction < 0 || source < 0) return;
      event.preventDefault();
      let target = neighbors(source, width, height)[direction];
      while (target >= 0 && cells[target].disabled) target = neighbors(target, width, height)[direction];
      if (target >= 0) cells[target].focus();
    }, { signal: view.signal });
  }
  return { board, cells };
}

export function paint(cell, symbol, label, kind = '') {
  if (cell.textContent !== symbol) cell.textContent = symbol;
  cell.setAttribute('aria-label', label);
  cell.className = `strategy-cell ${kind}`;
}

export function coordinate(index, width) {
  return `${String.fromCharCode(65 + index % width)}${Math.floor(index / width) + 1}`;
}

export function neighbors(index, width, height) {
  return directions.map(({ dx, dy }) => {
    const x = index % width + dx;
    const y = Math.floor(index / width) + dy;
    return x >= 0 && x < width && y >= 0 && y < height ? y * width + x : -1;
  });
}

export function buildNetwork(view, nodes, edges, choose, ticks) {
  const map = element(view.root, 'div', 'strategy-network');
  const markers = {};
  const links = edges.map(edge => {
    const [a, b] = edge;
    const [x, y] = nodes[a].position;
    const [nextX, nextY] = nodes[b].position;
    const line = element(map, 'span', 'strategy-link');
    const dx = nextX - x;
    const dy = (nextY - y) / 2;
    line.style.left = x + '%';
    line.style.top = y + '%';
    line.style.width = Math.hypot(dx, dy) + '%';
    line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    const label = element(map, 'span', 'strategy-link-label', ticks(edge));
    label.style.left = (x + nextX) / 2 + '%';
    label.style.top = (y + nextY) / 2 + '%';
    return { line, label, edge };
  });
  for (const [key, node] of Object.entries(nodes)) {
    const marker = view.button(map, node.name, () => choose(key), 'strategy-node');
    marker.style.left = node.position[0] + '%';
    marker.style.top = node.position[1] + '%';
    markers[key] = marker;
  }
  return { markers, links };
}
