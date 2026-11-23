const time = { label: '计分用时', unit: '秒', direction: 'asc' };

export const games = [
  {
    id: 'idiom-fill', name: '成语补字', description: '读释义，补齐三十六个成语里的缺字。', icon: '成',
    rules: ['根据释义，从四个字里选出缺失的字。', '答对才能进入下一题。每次答错加 3 秒，计分用时越短越好。'], metric: time,
  },
  {
    id: 'chinese-crossword', name: '格中字谜', description: '从横竖线索解出互相交叉的四字词。', icon: '格',
    rules: ['选择横向或纵向线索，点击字格和候选字来填词。', '交叉格共用同一个字。填完字格并核对，解开三盘字谜。'],
  },
  {
    id: 'radical-builder', name: '偏旁造字', description: '把字的部件按左右、上下或内外组合。', icon: '拼',
    rules: ['根据字义和结构，按指定顺序选两个部件。', '确认组合后可进入下一题，选错时可以重试。'],
  },
  {
    id: 'word-groups', name: '词语归组', description: '从十六个词里找出四组相同主题。', icon: '类',
    rules: ['选出四个属于同一类的词，再提交一组。', '解完两盘才算通关。每次错分加 8 秒，使用提示进入练习。'], metric: time,
  },
  {
    id: 'word-ladder', name: '字母阶梯', description: '每步换一个字母，从一个英文词走到另一个。', icon: 'A',
    rules: ['从词库里选一个单词，每步只能改变同一位置上的一个字母。', '完成三段阶梯。每次成功前进都计一步，退回也不会抵消已走步数。', '总步数越少越好，使用提示进入练习。'], metric: { label: '总步数', unit: '步', direction: 'asc' },
  },
  {
    id: 'word-search', name: '单词寻踪', description: '在字母方阵里圈出藏在各个方向的单词。', icon: '寻',
    rules: ['先点首字母，再点尾字母。', '单词可能横、竖或斜着藏在方阵里，也可能反向排列。', '找到每一盘的全部目标词即可通关。'],
  },
  {
    id: 'cipher-letter', name: '密文来信', description: '转动移位密码，读出藏在字母串里的英文留言。', icon: '密',
    rules: ['密信中的字母全都按相同步数在 A–Z 中循环移位。', '用加减键调整向前还原的步数，预览字母变化，再提交译文。'],
  },
  {
    id: 'witness-logic', name: '证词推理', description: '比对每个人的说法，找出符合真假条件的唯一人选。', icon: '证',
    rules: ['每案只有一名符合目标的人，每条证词只有真或假。', '可以先在证词旁做真假标记，再选择人选并核对。'],
  },
  {
    id: 'twenty-four', name: '巧算二十四点', description: '用算式拼合四张数字牌，算出 24。', icon: '24',
    rules: ['选左操作数、运算符和右操作数，把两张牌合成一张。', '只准使用加、减、乘、除和括号，每张原始牌恰好用一次。允许中间出现分数，不能除以零。', '完成四组牌，按通关用时排名。查看解法进入练习。'], metric: { label: '通关用时', unit: '秒', direction: 'asc' },
  },
  {
    id: 'sequence-detective', name: '数列侦探', description: '从数字之间的关系推断每组数列的两个空位。', icon: '数',
    rules: ['找出每行数字的共同规律，把缺失的数字填入两个空格。', '可以查看本题的规律提示。填完八题即可通关。'],
  },
];
