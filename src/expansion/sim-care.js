import { actions, button, grid, note, station, stats } from './sim-ui.js';

const CROPS = [
  { name: '生菜', mark: '生', min: 15, max: 23, weeks: 2, color: 'leaf' },
  { name: '番茄', mark: '番', min: 19, max: 28, weeks: 3, color: 'brick' },
  { name: '萝卜', mark: '萝', min: 13, max: 21, weeks: 2, color: 'ochre' },
];
const SEASONS = ['春季', '夏季', '秋季', '冬季'];
const TEMPERATURES = [17, 19, 21, 25, 27, 29, 22, 20, 18, 13, 15, 17];
const EMPTY_BED = { crop: -1, water: 0, growth: 0, stalled: 0 };

export function greenhouse(host, api) {
  const beds = Array.from({ length: 4 }, () => ({ ...EMPTY_BED }));
  const harvested = CROPS.map(() => 0);
  let week = 0;
  let chores = 4;
  let climate = 0;
  let tool = 'seed-0';
  let summary = '春天到了，先选作物，再选一块空苗床。';
  const temperature = () => TEMPERATURES[Math.min(week, TEMPERATURES.length - 1)] + climate;
  const total = () => harvested.reduce((sum, amount) => sum + amount, 0);

  function canTend(bed) {
    if (chores === 0) return false;
    if (tool.startsWith('seed-')) return bed.crop < 0;
    if (tool === 'water') return bed.crop >= 0 && bed.water < 3 && bed.growth < CROPS[bed.crop].weeks;
    return bed.crop >= 0 && bed.growth >= CROPS[bed.crop].weeks;
  }

  function view(done) {
    const current = Math.min(week, TEMPERATURES.length - 1);
    return `${stats(['季节', `${SEASONS[Math.floor(current / 3)]} · 第 ${current % 3 + 1} 周`], ['室温', `${TEMPERATURES[current] + climate}°C`], ['已采收 / 照料次数', `${total()} / ${chores}`])}
      <div class="sim-house">${grid(2, beds.map((bed, i) => {
        const crop = CROPS[bed.crop];
        const ready = crop && bed.growth >= crop.weeks;
        const heat = crop && !ready && (temperature() < crop.min || temperature() > crop.max);
        return button(`bed-${i}`, `<span class="sim-bed-plant ${crop?.color ?? ''}" style="--growth:${bed.growth}">${crop?.mark ?? ''}</span>
          <b>${i + 1} 号床 · ${crop?.name ?? '空地'}</b>
          <small>${crop ? ready ? '可以采收' : `湿度 ${bed.water} / 3 · 生长 ${bed.growth} / ${crop.weeks}${heat ? ' · 温度不适' : ''}` : '等待播种'}</small>`,
          { disabled: done || !canTend(bed), kind: 'sim-bed' });
      }), 'sim-beds', '温室苗床')}</div>
      <div class="sim-crop-ledger">${CROPS.map((crop, i) => `<span>${crop.name} 已收 <b>${harvested[i]}</b></span>`).join('')}</div>
      ${actions(...CROPS.map((crop, i) => button(`seed-${i}`, `${crop.name} <small>${crop.min}–${crop.max}°</small>`, { pressed: tool === `seed-${i}`, disabled: done })),
        button('water', '浇水 +2', { pressed: tool === 'water', disabled: done }),
        button('harvest', '采收', { pressed: tool === 'harvest', disabled: done }),
        button('warm', '暖风 +2°', { disabled: done || !chores || climate >= 4 }),
        button('vent', '通风 −2°', { disabled: done || !chores || climate <= -4 }),
        button('advance', done || week === TEMPERATURES.length - 1 ? '结束本年' : '进入下周', { disabled: done, kind: 'sim-primary' }))}
      ${note(summary)}`;
  }

  function move(key) {
    if (key === 'warm' || key === 'vent') {
      climate += key === 'warm' ? 2 : -2;
      chores--;
      summary = `温室调到 ${temperature()}°C。`;
      return { message: summary };
    }
    if (key.startsWith('bed-')) {
      const bed = beds[Number(key.split('-')[1])];
      if (tool === 'water') {
        bed.water = Math.min(3, bed.water + 2);
        summary = '已浇水。';
      } else if (tool === 'harvest') {
        harvested[bed.crop]++;
        summary = `采收了${CROPS[bed.crop].name}。`;
        Object.assign(bed, EMPTY_BED);
      } else {
        bed.crop = Number(tool.split('-')[1]);
        bed.water = 2;
        summary = `种下了${CROPS[bed.crop].name}，播种湿度 2。`;
      }
      chores--;
      return { message: summary };
    }
    if (key !== 'advance') {
      tool = key;
      return;
    }
    let grew = 0;
    let wilted = 0;
    const heat = temperature();
    for (const bed of beds) {
      const crop = CROPS[bed.crop];
      if (!crop || bed.growth >= crop.weeks) continue;
      if (bed.water > 0 && heat >= crop.min && heat <= crop.max) {
        bed.growth++;
        grew++;
      }
      bed.stalled = bed.water === 0 ? bed.stalled + 1 : 0;
      bed.water = Math.max(0, bed.water - (heat >= 27 ? 2 : 1));
      if (bed.stalled >= 2) {
        Object.assign(bed, EMPTY_BED);
        wilted++;
      }
    }
    summary = `本周有 ${grew} 株作物生长${wilted ? `，${wilted} 株因缺水枯萎` : ''}。`;
    if (++week === TEMPERATURES.length) {
      const success = total() >= 6 && harvested.every(Boolean);
      return { end: `${success ? '四季丰收。' : '一年结束，采收目标尚未完成。'}共收成 ${total()} 株，${CROPS.map((crop, i) => `${crop.name} ${harvested[i]} 株`).join('、')}。` };
    }
    chores = 4;
    climate = 0;
    return { message: summary };
  }

  station(host, api, 'greenhouse', view, move);
}

const ROOMS = [
  { name: '林景单间', room: '101', cap: 1, twin: false },
  { name: '山景单间', room: '102', cap: 1, twin: false },
  { name: '双床房', room: '201', cap: 2, twin: true },
  { name: '家庭套房', room: '202', cap: 3, twin: false },
];
const BOOKINGS = [
  [['姚阿婆', 1, 2, 46], ['摄影搭档', 2, 1, 76, true]],
  [['徒步伙伴', 2, 2, 80, true], ['写生旅人', 1, 1, 54]],
  [['观星一家', 3, 2, 110], ['巡山员', 1, 1, 52]],
  [['戏团搭档', 2, 1, 82, true], ['手艺人', 1, 2, 48]],
  [['老熟客', 2, 1, 88], ['骑行搭档', 2, 2, 86, true]],
  [['过路邮差', 1, 1, 58], ['露营一家', 3, 1, 112]],
].map(night => night.map(([name, party, stay, rate, twin = false], i) => ({ name, party, stay, rate, twin, required: i === 0 })));

export function inn(host, api) {
  const rooms = ROOMS.map(room => ({ ...room, guest: null, until: 0, clean: true }));
  const assigned = new Set();
  let night = 0;
  let cleaners = 2;
  let selected = -1;
  let cash = 0;
  let stars = 0;
  let missed = 0;
  let summary = '选择预约，然后分配干净的空房。';
  const canStay = (room, book) => book && !room.guest && room.clean && room.cap >= book.party && (!book.twin || room.twin);

  function view(done) {
    const requests = BOOKINGS[Math.min(night, BOOKINGS.length - 1)];
    return `${stats(['夜晚', `${Math.min(night + 1, BOOKINGS.length)} / ${BOOKINGS.length}`], ['总营业额', `${cash} 元`], ['口碑 / 错过确认单', `${stars} / ${missed}`])}
      <div class="x-toolbar sim-banner"><b>房态一览</b><span>今晚可清扫 ${cleaners} 间</span></div>
      ${grid(2, rooms.map((room, i) => button(`room-${i}`, `<span class="sim-door ${room.guest ? 'occupied' : room.clean ? 'clean' : 'dirty'}">${room.room}</span>
        <b>${room.name} · ${room.cap} 人</b><small>${room.guest ? `${room.guest.name}入住 · 还住 ${Math.max(0, room.until - Math.min(night, BOOKINGS.length - 1))} 晚` : room.clean ? '空房' : '待清扫'}</small>`,
        { disabled: done || (room.clean ? !canStay(room, requests[selected]) : cleaners === 0), kind: 'sim-room' })), 'sim-rooms', '旅店客房')}
      <div class="sim-tickets" aria-label="今晚的预订">${requests.map((request, i) => button(`book-${i}`, `<span><b>${request.name}${request.required ? ' · 已确认' : ''}</b>
        <small>${request.party} 人 · ${request.stay} 晚${request.twin ? ' · 须双床' : ''}</small></span><strong>${assigned.has(i) ? '已入住' : `${request.rate} 元 / 晚`}</strong>`,
        { disabled: done || assigned.has(i), pressed: selected === i, kind: 'sim-ticket' })).join('')}</div>
      ${actions(button('sleep', '结束接待 · 结算今晚', { disabled: done, kind: 'sim-primary' }))}
      ${note(summary)}`;
  }

  function move(key) {
    const [action, index] = key.split('-');
    const i = Number(index);
    if (action === 'book') {
      selected = selected === i ? -1 : i;
      return;
    }
    if (action === 'room') {
      const room = rooms[i];
      if (!room.clean) {
        room.clean = true;
        cleaners--;
        summary = `${room.room} 房已打扫，可以入住。`;
      } else {
        const booking = BOOKINGS[night][selected];
        room.guest = booking;
        room.until = night + booking.stay;
        assigned.add(selected);
        selected = -1;
        if (room.cap === booking.party) stars++;
        summary = `${booking.name}已入住 ${room.room} 房${room.cap === booking.party ? '，容量刚好，口碑 +1' : ''}。`;
      }
      return { message: summary };
    }
    const income = rooms.reduce((sum, room) => sum + (room.guest?.rate ?? 0), 0);
    cash += income;
    if (!assigned.has(0)) missed++;
    summary = `第 ${++night} 晚入账 ${income} 元。`;
    if (night === BOOKINGS.length) {
      const success = cash >= 780 && stars >= 6 && missed === 0;
      return { end: `${success ? '山间旅店经营达标。' : '旅店尚未达成经营目标。'}六晚营业额 ${cash} 元，口碑 ${stars} 颗星，错过 ${missed} 张确认单。` };
    }
    for (const room of rooms) {
      if (room.guest && room.until <= night) {
        room.guest = null;
        room.clean = false;
      }
    }
    cleaners = 2;
    assigned.clear();
    selected = -1;
    return { message: summary };
  }

  station(host, api, 'inn', view, move);
}
