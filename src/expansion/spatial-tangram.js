import { arrowIndex, canvas, control, directions, element, keyboard, seconds } from './spatial-ui.js';

export const tangramPieces = [
  [[0, 0], [4, 0], [2, 2]],
  [[0, 0], [4, 0], [2, 2]],
  [[0, 0], [2, 0], [0, 2]],
  [[1, 0], [2, 1], [1, 2], [0, 1]],
  [[0, 0], [2, 0], [3, 1], [1, 1]],
  [[0, 0], [2, 0], [1, 1]],
  [[0, 0], [2, 0], [1, 1]],
];

const pieceNames = ['大三角一', '大三角二', '中三角', '正方形', '平行四边形', '小三角一', '小三角二'];
const pieceColors = ['#d58b62', '#718a50', '#9f7db1', '#e1bb57', '#629b9b', '#bd677e', '#7199bc'];
const triangleCenters = [[0.5, 0.125], [0.875, 0.5], [0.5, 0.875], [0.125, 0.5]];

export function tangramShape(piece, turn, flip) {
  const shape = tangramPieces[piece].map(([x, y]) => {
    if (flip) x = -x;
    for (let i = 0; i < turn; i++) [x, y] = [-y, x];
    return [x, y];
  });
  const minX = Math.min(...shape.map(([x]) => x));
  const minY = Math.min(...shape.map(([, y]) => y));
  return shape.map(([x, y]) => [x - minX, y - minY]);
}

const inside = (polygon, x, y) => {
  let side = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    const cross = Math.sign((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1));
    if (cross && side && cross !== side) return false;
    side ||= cross;
  }
  return true;
};

export function tangramCells(shape) {
  const cells = [];
  for (let y = Math.min(...shape.map(([, y]) => y)); y < Math.max(...shape.map(([, y]) => y)); y++) {
    for (let x = Math.min(...shape.map(([x]) => x)); x < Math.max(...shape.map(([x]) => x)); x++) {
      triangleCenters.forEach(([cx, cy], triangle) => {
        if (inside(shape, x + cx, y + cy)) cells.push(`${x},${y},${triangle}`);
      });
    }
  }
  return cells;
}

export function tangramPolygon(piece, [x, y, turn, flip = false]) {
  return tangramShape(piece, turn, flip).map(([px, py]) => [px + x, py + y]);
}

export const tangramLayouts = [
  ['方印', [[0,0,0],[0,0,3],[2,2,1,1],[1,2,0],[3,0,1],[0,3,2],[2,1,1]]],
  ['三角旗', [[0,0,0],[2,0,1],[4,0,3,1],[4,1,3],[5,0,2,1],[4,2,3],[5,1,0]]],
  ['斜旗', [[0,0,0],[2,0,1],[4,2,3],[4,1,3],[5,3,2],[4,0,3],[5,2,2]]],
  ['梯形台', [[1,0,3],[1,2,2],[1,0,1],[3,1,3],[4,3,2],[3,0,3],[4,2,2]]],
  ['尖塔', [[1,2,1],[1,4,3],[1,6,2],[1,1,3],[3,5,3,1],[0,5,1],[1,0,3]]],
  ['横舟', [[2,1,2],[4,1,0],[6,1,2],[2,0,3],[0,2,2,1],[6,3,0],[1,1,2]]],
  ['石柱', [[1,2,1],[1,0,3],[1,0,1],[0,4,3],[2,5,3,1],[1,7,2],[1,5,1]]],
  ['燕尾', [[4,1,2],[2,1,0],[6,1,1],[2,2,3],[0,1,2],[3,3,2],[3,0,2]]],
  ['跃鱼', [[3,0,2],[0,1,0],[5,0,1],[2,2,3],[3,3,2,1],[5,2,0],[3,4,0]]],
  ['立鸟', [[1,4,3],[1,2,1],[3,4,3],[0,2,3],[1,0,3,1],[0,0,1],[2,6,2]]],
  ['回钩', [[1,0,3],[1,2,1],[3,4,3],[2,0,3],[4,3,3,1],[1,0,0],[0,2,1]]],
  ['短靴', [[2,0,1],[0,0,0],[4,2,3,1],[5,2,3],[0,2,2],[0,1,2],[0,2,3]]],
];

export function mountTangram(host, api) {
  let stage = 0;
  let practice = false;
  let guide = false;
  let complete = false;
  let finished = false;
  let placing = 0;
  let turn = 0;
  let flip = false;
  let x = 0;
  let y = 0;
  let polygons;
  let target;
  let placements;
  let maxX, maxY, size, startX, startY;

  const toolbar = element(host, 'div', 'x-toolbar');
  const picker = element(toolbar, 'select', 'sp-control');
  picker.setAttribute('aria-label', '选择剪影练习');
  element(picker, 'option', '', '选择剪影练习').value = '';
  tangramLayouts.forEach(([name], index) => { element(picker, 'option', '', name).value = String(index); });
  picker.addEventListener('change', () => {
    if (picker.value === '' || finished) return;
    api.unrank();
    practice = true;
    stage = Number(picker.value);
    load();
  }, { signal: api.signal });
  const guideButton = control(toolbar, api, '提示分块', () => {
    if (finished) return;
    if (!guide) api.unrank();
    guide = !guide;
    draw();
  });
  const [surface, context] = canvas(host, 400, 400, '七巧板剪影棋盘');
  surface.tabIndex = 0;
  element(host, 'p', 'x-note sp-tan-instruction', '选拼片后，点格点定位，再按放置。');
  const tray = element(host, 'div', 'x-actions sp-tan-tray');
  const pieces = pieceNames.map((name, index) => {
    const button = control(tray, api, '', () => selectPiece(index), 'sp-control sp-tan-piece');
    const [, thumb] = canvas(button, 52, 40, name);
    const shape = tangramPieces[index];
    const width = Math.max(...shape.map(([px]) => px));
    const height = Math.max(...shape.map(([, py]) => py));
    drawPolygon(thumb, shape, (52 - width * 10) / 2, (40 - height * 10) / 2, 10, pieceColors[index], '#35413e');
    return button;
  });
  const actions = element(host, 'div', 'x-actions');
  const rotate = control(actions, api, '旋转 90°', () => rotatePiece());
  const reflect = control(actions, api, '翻面', () => reflectPiece());
  const commit = control(actions, api, '放置拼片', () => placePiece());
  const retrieve = control(actions, api, '取回拼片', () => takePiece());
  const next = control(actions, api, '下一幅剪影', () => {
    if (!complete || finished) return;
    stage++;
    load();
    surface.focus({ preventScroll: true });
  });

  surface.addEventListener('click', event => {
    if (complete || finished) return;
    const box = surface.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width * 400;
    const py = (event.clientY - box.top) / box.height * 400;
    if (px < startX - size / 2 || py < startY - size / 2 || px > startX + (maxX + 0.5) * size || py > startY + (maxY + 0.5) * size) return;
    x = clampX(Math.round((px - startX) / size));
    y = clampY(Math.round((py - startY) / size));
    draw();
  }, { signal: api.signal });

  keyboard(surface, api, key => {
    if (complete || finished) return false;
    const direction = arrowIndex(key);
    if (direction >= 0) {
      const [dx, dy] = directions[direction];
      x = clampX(x + dx);
      y = clampY(y + dy);
      draw();
    } else if (key === 'Enter' || key === ' ') placePiece();
    else if (key.toLowerCase() === 'r') rotatePiece();
    else if (key.toLowerCase() === 'f') reflectPiece();
    else return false;
    return true;
  });

  function clampX(value) { return Math.max(0, Math.min(maxX - 1, value)); }
  function clampY(value) { return Math.max(0, Math.min(maxY - 1, value)); }

  function load() {
    const [, layout] = tangramLayouts[stage];
    polygons = layout.map((transform, piece) => tangramPolygon(piece, transform));
    target = new Set(polygons.flatMap(tangramCells));
    maxX = Math.max(...polygons.flat().map(([px]) => px));
    maxY = Math.max(...polygons.flat().map(([, py]) => py));
    size = Math.min(70, 340 / Math.max(maxX, maxY));
    startX = (400 - maxX * size) / 2;
    startY = (400 - maxY * size) / 2;
    placements = new Array(7).fill(null);
    placing = turn = x = y = 0;
    flip = complete = false;
    draw();
  }

  function selectPiece(index) {
    if (complete || finished) return;
    placing = index;
    turn = 0;
    flip = false;
    draw();
  }

  function rotatePiece() {
    if (complete || finished || placements[placing]) return;
    turn = (turn + 1) % 4;
    draw();
  }

  function reflectPiece() {
    if (complete || finished || placements[placing]) return;
    flip = !flip;
    draw();
  }

  function canPlace(polygon) {
    const used = new Set(placements.filter(Boolean).flatMap(tangramCells));
    return tangramCells(polygon).every(cell => target.has(cell) && !used.has(cell));
  }

  function placePiece() {
    if (complete || finished || placements[placing]) return;
    const polygon = tangramPolygon(placing, [x, y, turn, flip]);
    if (!canPlace(polygon)) {
      api.status('这个位置超出剪影或碰到了另一块拼片。');
      return;
    }
    placements[placing] = polygon;
    const unplaced = placements.indexOf(null);
    if (unplaced < 0) {
      complete = true;
      finished = practice || stage === tangramLayouts.length - 1;
      draw();
      if (finished) api.end(practice ? '这幅剪影拼好了！' : '十二幅剪影全部完成！', seconds(api));
      return;
    }
    selectPiece(unplaced);
  }

  function takePiece() {
    if (complete || finished || !placements[placing]) return;
    placements[placing] = null;
    draw();
  }

  function draw() {
    context.clearRect(0, 0, 400, 400);
    polygons.forEach(polygon => drawPolygon(context, polygon, startX, startY, size, '#d9d7c7', guide ? '#6f7864' : null));
    for (let gy = 0; gy <= maxY; gy++) {
      for (let gx = 0; gx <= maxX; gx++) {
        context.beginPath();
        context.arc(startX + gx * size, startY + gy * size, 2, 0, 2 * Math.PI);
        context.fillStyle = '#67756780';
        context.fill();
      }
    }
    placements.forEach((polygon, index) => {
      if (polygon) drawPolygon(context, polygon, startX, startY, size, pieceColors[index], placing === index && !complete ? '#fffbeb' : '#3e4a43');
    });
    const preview = tangramPolygon(placing, [x, y, turn, flip]);
    const available = !placements[placing] && !complete;
    const valid = available && canPlace(preview);
    if (available) {
      drawPolygon(context, preview, startX, startY, size, valid ? '#46845965' : '#a54d5c42', valid ? '#286042' : '#8f374e');
      context.beginPath();
      context.arc(startX + x * size, startY + y * size, 5, 0, 2 * Math.PI);
      context.fillStyle = valid ? '#286042' : '#8f374e';
      context.fill();
    }
    pieces.forEach((button, index) => {
      button.classList.toggle('sp-used', Boolean(placements[index]));
      button.setAttribute('aria-pressed', String(index === placing && !complete));
      button.setAttribute('aria-label', `${pieceNames[index]}${placements[index] ? '，已放置' : ''}`);
      button.disabled = complete;
    });
    rotate.disabled = reflect.disabled = commit.disabled = !available;
    retrieve.disabled = complete || !placements[placing];
    guideButton.setAttribute('aria-pressed', String(guide));
    guideButton.textContent = guide ? '隐藏提示' : '提示分块';
    next.hidden = !complete || finished;
    picker.disabled = finished;
    surface.setAttribute('aria-label', `七巧板剪影棋盘，${tangramLayouts[stage][0]}，定位第 ${y + 1} 行第 ${x + 1} 列${available ? valid ? '，可放置' : '，不可放置' : ''}`);
    api.status(`第 ${stage + 1} / ${tangramLayouts.length} 图 · ${tangramLayouts[stage][0]} · ${placements.filter(Boolean).length} / 7 片${complete ? ' · 已完成' : valid ? ' · 可以放置' : ''}`);
  }
  load();
  surface.focus({ preventScroll: true });
}

function drawPolygon(context, polygon, left, top, scale, fill, stroke) {
  context.beginPath();
  polygon.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(left + x * scale, top + y * scale);
    else context.lineTo(left + x * scale, top + y * scale);
  });
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.lineJoin = 'round';
    context.stroke();
  }
}
