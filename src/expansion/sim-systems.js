import { actions, button, grid, int, note, station, stats } from './sim-ui.js';

const SHIFTS = [
  { name: '06:00', solar: 0, wind: 2, clinic: 2, home: 3, rate: 2 },
  { name: '08:00', solar: 2, wind: 2, clinic: 3, home: 3, rate: 2 },
  { name: '10:00', solar: 4, wind: 2, clinic: 3, home: 4, rate: 1 },
  { name: '12:00', solar: 8, wind: 2, clinic: 4, home: 4, rate: 1 },
  { name: '15:00', solar: 6, wind: 3, clinic: 3, home: 5, rate: 1 },
  { name: '18:00', solar: 1, wind: 2, clinic: 4, home: 5, rate: 3 },
  { name: '21:00', solar: 0, wind: 2, clinic: 4, home: 4, rate: 3 },
  { name: '00:00', solar: 0, wind: 4, clinic: 3, home: 3, rate: 2 },
];

export function gridDispatch(host, api) {
  const MAX_CHARGE = 6;
  const MAX_BUY = 4;
  const COST_CAP = 26;
  const schedules = SHIFTS.map(shift => ({ ...shift, wind: Math.max(1, shift.wind + int(api.random, -1, 1)) }));
  let shift = 0;
  let charge = 3;
  let spent = 0;
  let homes = 0;
  let missed = 0;
  let connectHome = true;
  let flow = 'output';
  let purchase = 0;
  let summary = '优先保证医院供电，平衡居民用电和购电支出。';
  const timeline = [];

  function dispatch(plan) {
    const generation = plan.solar + plan.wind;
    const load = plan.clinic + (connectHome ? plan.home : 0);
    const gap = generation + purchase - load;
    const delta = flow === 'output' && gap < 0 ? -Math.min(charge, 3, -gap)
      : flow === 'store' && gap > 0 ? Math.min(MAX_CHARGE - charge, 3, gap)
      : 0;
    const available = generation + purchase - delta;
    return { load, available, delta, expense: purchase * plan.rate, hospitalOn: available >= plan.clinic, homeOn: connectHome && available >= load };
  }

  function view(done) {
    const current = schedules[Math.min(shift, schedules.length - 1)];
    const plan = done ? null : dispatch(current);
    return `${stats(['班次', `${Math.min(shift + 1, schedules.length)} / ${schedules.length}`], ['购电', `${spent} / ${COST_CAP} 元`], ['居民通电 / 医院停电', `${homes} / ${missed}`])}
      <div class="sim-power-panel">
        <div class="sim-clock"><b>${current.name}</b><span>本班电价 ${current.rate} 元 / 格</span></div>
        <div class="sim-power-flow">
          <div><small>发电</small><b>日照 ${current.solar}</b><b>风力 ${current.wind}</b></div>
          <div class="sim-battery"><small>储能 ${charge} / ${MAX_CHARGE}</small><div aria-hidden="true">${Array.from({ length: MAX_CHARGE }, (_, i) => `<i class="${i < charge ? 'charged' : ''}"></i>`).join('')}</div></div>
          <div><small>负荷</small><b>医院 ${current.clinic}</b><b>居民 ${current.home}</b></div>
        </div>
        ${plan ? `<p class="sim-power-forecast">可供 <b>${plan.available}</b> / 需求 <b>${plan.load}</b> · ${plan.hospitalOn ? '医院通电' : '医院电量不足'} · ${plan.homeOn ? '居民通电' : '居民停电'}</p>` : ''}
        <div class="sim-shift-line" aria-label="各班供电结果">${schedules.map((slot, i) => `<span class="${shift === i ? 'current' : ''} ${timeline[i]?.hospitalOn === false ? 'outage' : ''}"><small>${slot.name}</small><b>${timeline[i] ? timeline[i].homeOn ? '全供' : timeline[i].hospitalOn ? '医院' : '中断' : '待调度'}</b></span>`).join('')}</div>
      </div>
      ${actions(button('home', connectHome ? '居民接入' : '居民断开', { disabled: done, pressed: connectHome }),
        ...[['output', '电池放电'], ['store', '电池充电'], ['hold', '电池待机']].map(([key, label]) => button(key, label, { disabled: done, pressed: flow === key })))}
      <div class="sim-dispatch">
        <div class="sim-stepper">${button('buy-less', '−', { disabled: done || !purchase, title: '少购一格电' })}<span>购电 <b>${purchase}</b> 格</span>${button('buy-more', '+', { disabled: done || purchase === MAX_BUY, title: '多购一格电' })}</div>
        ${button('switch', '执行供电', { disabled: done, kind: 'sim-primary' })}
      </div>${note(summary)}`;
  }

  function move(key) {
    if (key !== 'switch') {
      if (key === 'home') connectHome = !connectHome;
      else if (key === 'buy-more') purchase++;
      else if (key === 'buy-less') purchase--;
      else flow = key;
      return;
    }
    const current = schedules[shift];
    const outcome = dispatch(current);
    charge += outcome.delta;
    spent += outcome.expense;
    if (outcome.homeOn) homes++;
    if (!outcome.hospitalOn) missed++;
    timeline.push(outcome);
    summary = `${current.name} ${outcome.homeOn ? '医院和居民均通电' : outcome.hospitalOn ? '仅医院通电' : '医院供电中断'}，购电花费 ${outcome.expense} 元。`;
    if (++shift === schedules.length) {
      const success = missed === 0 && homes >= 6 && spent <= COST_CAP;
      return { end: `${success ? '社区调度达标。' : '电网未完成调度目标。'}医院停电 ${missed} 班，居民通电 ${homes} 班，购电 ${spent} 元。` };
    }
    purchase = 0;
    return { message: summary };
  }

  station(host, api, 'power', view, move);
}

const MATERIALS = [
  { name: '纸类', mark: '纸', color: 'ochre', limit: 3 },
  { name: '塑料', mark: '塑', color: 'sea', limit: 3 },
  { name: '金属', mark: '金', color: 'leaf', limit: 3 },
  { name: '残余', mark: '余', color: 'plum', limit: 4 },
];
const ARTICLES = [
  ['纸盒', 0], ['旧报纸', 0], ['纸袋', 0], ['饮料塑料瓶', 1], ['塑料餐盒', 1],
  ['塑料外卖盒', 1], ['铝罐', 2], ['铁盒', 2], ['金属罐头', 2], ['用过的纸巾', 3], ['碎陶片', 3],
];
const TRUCKS = [
  [[0], [3], [5, true], [6], [1, true], [9], [7]],
  [[2], [4, true], [6], [0], [5], [10], [8, true]],
  [[1], [3, true], [8], [2], [4], [9], [7, true]],
];

export function recycling(host, api) {
  const trucks = TRUCKS.map(contents => {
    const offset = int(api.random, 0, contents.length - 1);
    return contents.slice(offset).concat(contents.slice(0, offset)).map(([id, dirty]) => ({
      name: ARTICLES[id][0], material: ARTICLES[id][1], dirty: !!dirty,
    }));
  });
  const bins = MATERIALS.map(() => 0);
  let truck = 0;
  let position = 0;
  let wash = 2;
  let hauls = 2;
  let correct = 0;
  let mistakes = 0;
  let haulMode = false;
  let summary = '按材质投入回收箱，受油污污染的物品可以先清洗。';
  const item = () => trucks[truck]?.[position];
  const blocked = () => hauls === 0 && bins.every((amount, i) => amount >= MATERIALS[i].limit);

  function view(done) {
    const current = item();
    return `${stats(['清运车', `${Math.min(truck + 1, trucks.length)} / ${trucks.length}`], ['正确回收', `${correct} / 14`], ['误投', mistakes])}
      <div class="sim-belt"><div class="sim-on-belt">
        <span class="sim-parcel ${current?.dirty ? 'dirty' : ''}" aria-hidden="true">${current ? current.name.slice(-1) : '✓'}</span>
        <b>${current?.name ?? '传送带已清空'}</b><small>${current ? current.dirty ? '有油污 · 可先洗净' : '无油污' : '等待清运'}</small>
      </div><div class="sim-belt-segments" aria-hidden="true">${Array.from({ length: 9 }, () => '<i></i>').join('')}</div></div>
      <div class="sim-queue" aria-label="待处理废品">${trucks[truck]?.slice(position + 1).map(value => `<span>${value.name}${value.dirty ? ' · 油污' : ''}</span>`).join('') ?? ''}</div>
      ${grid(4, MATERIALS.map((bin, i) => button(`bin-${i}`, `<span aria-hidden="true" class="sim-bin-mark">${bin.mark}</span><b>${bin.name}</b><small>${bins[i]} / ${bin.limit}${bins[i] === bin.limit ? ' 已满' : ''}</small>`,
        { disabled: done || (haulMode ? !bins[i] || !hauls : !current || bins[i] >= bin.limit), kind: `sim-bin ${bin.color}` })), 'sim-bins', haulMode ? '选择要清运的回收箱' : '分类投放')}
      ${actions(button('wash', `清洗 · 剩 ${wash} 次`, { disabled: done || !current?.dirty || !wash }),
        button('haul', `清运回收箱 · 剩 ${hauls} 次`, { disabled: done || !hauls || bins.every(n => !n), pressed: haulMode }),
        blocked() && current ? button('return', '箱满 · 退回废品', { disabled: done }) : '',
        button('truck', truck >= trucks.length - 1 ? '结束工作' : '接下一车', { disabled: done || !!current, kind: 'sim-primary' }))}
      ${note(summary)}`;
  }

  function move(key) {
    const current = item();
    if (key === 'haul') {
      haulMode = !haulMode;
      summary = haulMode ? '选择要清空的回收箱。' : '恢复分类投放。';
    } else if (key === 'wash') {
      current.dirty = false;
      wash--;
      summary = `已洗净${current.name}，请选择回收箱。`;
    } else if (key === 'return') {
      position++;
      mistakes++;
      summary = `回收箱已满，${current.name}退回，计一次误投。`;
    } else if (key === 'truck') {
      if (++truck === trucks.length) {
        const success = correct >= 14 && mistakes <= 2;
        return { end: `${success ? '三车分类完成，回收达标。' : '分类工作结束，回收目标尚未达成。'}正确回收 ${correct} 件，误投 ${mistakes} 件。` };
      }
      position = 0;
      wash = hauls = 2;
      haulMode = false;
      summary = '新一车已进站，洗槽和清运次数已补满。';
    } else {
      const i = Number(key.split('-')[1]);
      if (haulMode) {
        bins[i] = 0;
        hauls--;
        haulMode = false;
        summary = `${MATERIALS[i].name}箱已清空。`;
      } else {
        const target = current.dirty ? 3 : current.material;
        bins[i]++;
        if (i !== target) mistakes++;
        else if (i !== 3) correct++;
        summary = i === target ? `已把${current.name}投入${MATERIALS[i].name}箱。` : `误投：${current.name}应投入${MATERIALS[target].name}箱。`;
        position++;
      }
    }
    return { message: summary };
  }

  station(host, api, 'recycling', view, move);
}

const SHOWS = [
  { name: '纸船旅行', set: '木景', color: 'ochre', length: 2, best: '下午', audience: 69 },
  { name: '午后的偶戏', set: '木景', color: 'ochre', length: 1, best: '下午', audience: 53 },
  { name: '深夜电台', set: '灯景', color: 'brick', length: 2, best: '晚上', audience: 74 },
  { name: '邻里即兴', set: '空台', color: 'leaf', length: 1, best: '晚上', audience: 58 },
  { name: '星期天合唱', set: '空台', color: 'leaf', length: 1, best: '下午', audience: 50 },
  { name: '星光独白', set: '灯景', color: 'brick', length: 1, best: '晚上', audience: 59 },
];
const THEATER_DAYS = ['周五', '周六', '周日'];
const SLOTS = ['14:00', '16:00', '19:00', '21:00'];

export function theater(host, api) {
  const schedule = THEATER_DAYS.map(() => SLOTS.map(() => -1));
  const placements = new Map();
  let choice = -1;
  let summary = '选一个节目，再点它的开场时间。点已排场次可以撤销。';
  const audience = (id, day, slot) => {
    const show = SHOWS[id];
    return show.audience + (show.best === (slot < 2 ? '下午' : '晚上') ? 8 : -18)
      + [0, 6, 2][day] + (id === 4 && day === 2 ? 12 : 0);
  };
  const total = () => [...placements].reduce((sum, [id, [day, slot]]) => sum + audience(id, day, slot), 0);

  function available(id, day, start) {
    const row = schedule[day];
    const show = SHOWS[id];
    const end = start + show.length;
    if (end > row.length || row.slice(start, end).some(value => value !== -1)) return false;
    return [row[start - 1], row[end]].every(neighbor => !SHOWS[neighbor] || SHOWS[neighbor].set === show.set);
  }

  function view(done) {
    return `${stats(['已排演出', `${placements.size} / 4`], ['预计观众', `${total()} / 250`])}
      <div class="sim-marquee"><b>开场时间</b><div>${SLOTS.map(time => `<small>${time}</small>`).join('')}</div></div>
      <div class="sim-calendar" aria-label="舞台时间表">
        ${schedule.map((row, day) => `<div class="sim-calendar-day"><b>${THEATER_DAYS[day]}</b>${grid(4, row.map((id, slot) => {
          const start = placements.get(id)?.[1] === slot;
          const open = id === -1;
          const show = SHOWS[id];
          const valid = choice !== -1 && available(choice, day, slot);
          return button(`slot-${day}-${slot}`, open ? valid ? `<b>${audience(choice, day, slot)} 人</b><small>可开场</small>` : '—' : `<b>${start ? show.name : '续场'}</b><small>${start ? `${audience(id, day, slot)} 人` : show.set}</small>`,
            { disabled: done || (open && !valid), kind: `sim-slot ${open ? '' : show.color}`, title: `${THEATER_DAYS[day]} ${SLOTS[slot]}${open ? valid ? `，预计 ${audience(choice, day, slot)} 名观众` : '，空场' : `，撤销${show.name}`}` });
        }), 'sim-slots')}</div>`).join('')}
      </div>
      ${grid(3, SHOWS.map((show, id) => button(`select-${id}`, `<b>${show.name}</b><small>${show.length} 格 · ${show.set} · 宜${show.best}</small>${placements.has(id) ? '<small>已排定</small>' : ''}`,
        { disabled: done || placements.has(id) || placements.size === 4, pressed: choice === id, kind: `sim-program ${show.color}` })), 'sim-programs', '待排剧目')}
      ${actions(button('finalize', '提交排期', { disabled: done || placements.size < 4, kind: 'sim-primary' }))}
      ${note(summary)}`;
  }

  function move(key) {
    if (key === 'finalize') return { end: `${total() >= 250 ? '小剧场排期成功。' : '排期完成，预计观众尚未达到目标。'}四场演出预计迎来 ${total()} 人。` };
    const [action, a, b] = key.split('-');
    const day = Number(a);
    if (action === 'select') {
      choice = choice === day ? -1 : day;
      summary = choice < 0 ? '已取消选中的剧目。' : `已选${SHOWS[choice].name}；不同布景之间需留一格换景。`;
      return;
    }
    const slot = Number(b);
    const existing = schedule[day][slot];
    if (existing >= 0) {
      const [, start] = placements.get(existing);
      schedule[day].fill(-1, start, start + SHOWS[existing].length);
      placements.delete(existing);
      summary = `已撤销${SHOWS[existing].name}。`;
      return;
    }
    schedule[day].fill(choice, slot, slot + SHOWS[choice].length);
    placements.set(choice, [day, slot]);
    summary = `${SHOWS[choice].name}排在${THEATER_DAYS[day]} ${SLOTS[slot]}，预计 ${audience(choice, day, slot)} 名观众。`;
    choice = -1;
    return { message: summary };
  }

  station(host, api, 'theater', view, move);
}
