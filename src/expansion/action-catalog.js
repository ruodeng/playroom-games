export const games = [
  {
    id: 'ruin-treasure', name: '横版遗迹寻宝', icon: '◇', description: '越过断桥，在六段遗迹中集齐琥珀晶石。',
    rules: ['按住方向按钮或左右键移动，按跳跃按钮或空格起跳。', '每段有三枚晶石，集齐后才能穿过石门。落入深坑会重新开始这一段。', '通过六段遗迹后记录通关用时。'],
    metric: { label: '通关用时', unit: '秒', direction: 'asc' },
  },
  {
    id: 'pendulum-tower', name: '钟摆攀塔', icon: '◔', description: '跟着钟摆转动的节拍，抓住下一个铜环。',
    rules: ['沿当前铜环摆动。身体接近发光的上方铜环时，按抓环按钮或空格。', '按早或按晚会等下一次机会。攀到尖塔顶端后记录用时。'],
    metric: { label: '登顶用时', unit: '秒', direction: 'asc' },
  },
  {
    id: 'gravity-flip', name: '重力翻转', icon: '↕', description: '在上下两条轨道之间翻转，绕开管道里的闸板。',
    rules: ['飞轮自动前进。按翻转按钮或空格，改变重力方向。', '避开红色闸板，每通过一扇得 100 分。每颗青色光珠得 25 分。', '穿过出口另得 300 分，撞上闸板时结算已得分数。'],
    metric: { label: '轨道得分', unit: '分', direction: 'desc' },
  },
  {
    id: 'rock-drill', name: '穿岩钻车', icon: '◆', description: '读懂矿层，开出一条能量开销最低的出路。',
    rules: ['点按或长按方向按钮、方向键移动。黑色地形不可钻开。砂土、页岩、硬岩分别消耗 1、2、4 点能量，已挖通的格子不用消耗能量。', '绿格补充 10 点能量。采齐六块矿晶后驶入绿色出口。', '抵达出口时为剩余能量排名。'],
    metric: { label: '剩余能量', unit: '点', direction: 'desc' },
  },
  {
    id: 'shadow-mechanism', name: '影子机关', icon: '◐', description: '推箱遮住光束，用影子打开四间密室。',
    rules: ['用方向按钮或方向键移动，把木箱推进灯光。只能推箱，一次只能推一个。', '每束光右端的感应器都进入阴影时，机关门才会打开。走到出口进入下一间。', '当前房间可以重置，计时继续。通过四间后记录用时。'],
    metric: { label: '解机关用时', unit: '秒', direction: 'asc' },
  },
  {
    id: 'stealth-key', name: '潜行取钥', icon: '⚿', description: '贴着阴影穿过巡逻线，将钥匙带到撤离门。',
    rules: ['点按或长按方向按钮、方向键移动。蓝色地板可以隐藏，墙壁挡住巡逻员的视线。', '走进视野会增加警觉，离开视野后会下降。撞到巡逻员或警觉满格都会失败。', '拿到钥匙后撤离，按用时排名。'],
    metric: { label: '撤离用时', unit: '秒', direction: 'asc' },
  },
  {
    id: 'lava-escape', name: '熔岩逃生', icon: '▲', description: '踏着浮石一路弹跳，在熔岩涨上来之前冲顶。',
    rules: ['触及浮石会自动弹跳。按住方向按钮或左右键，空中调整落点。', '每上升 10 米最高纪录得 1 分，每朵火种得 40 分。登顶奖励 500 分。', '跌进熔岩时也会结算已得分数。'],
    metric: { label: '逃生得分', unit: '分', direction: 'desc' },
  },
  {
    id: 'lunar-landing', name: '月面着陆', icon: '☾', description: '控制推力和倾角，用有限燃料轻触月面着陆台。',
    rules: ['长按左右按钮或方向键调整倾角，长按推力按钮、上键或空格点火。', '在青色着陆台内垂直贴近地面。接地时横向速度须不超过 27、下落速度不超过 55、倾角不超过 13°。', '成功着陆后，剩余燃料越多排名越高。'],
    metric: { label: '剩余燃料', unit: '%', direction: 'desc' },
  },
  {
    id: 'river-raft', name: '急流漂筏', icon: '≋', description: '逆着偏流压桨，穿过狭窄的白水河湾。',
    rules: ['按住方向按钮或左右键划桨，松手后木筏仍会顺流偏移。', '避开岸边和岩石。木筏可承受两次撞击，第三次会沉没。', '漂行距离、浮标和抵达终点都会得分。'],
    metric: { label: '漂流得分', unit: '分', direction: 'desc' },
  },
  {
    id: 'glider-gates', name: '滑翔穿门', icon: '⌁', description: '以俯冲换取速度，再拉升穿过山谷中的风门。',
    rules: ['长按拉升或俯冲按钮、上下键控制机头，松开会逐渐回平。', '拉升减速，俯冲加速。穿过风门中心附近得分更高，贴边仍可继续飞。', '当心山壁和飞行高度边缘。飞完全程得 250 分。'],
    metric: { label: '滑翔得分', unit: '分', direction: 'desc' },
  },
];
