/* ============================================================
   站点元数据：分区、阵营与代理人、状态标签
   ------------------------------------------------------------
   · CAMPS 是筛选器的数据源，一共 18 个阵营 + 「其他」。
   · 阵营下挂 agents，构成「阵营 → 角色」两级筛选。
   · 制品的 characters 字段填 agent 的 key（如 'anby'），
     不要填中文名，否则筛选命不中。
   · 新增角色只需在对应阵营的 agents 里追加一项。
   ============================================================ */

(function (root) {
  'use strict';
  root.FES = root.FES || {};

  /* 分区：由摊位编号首字母推导 */
  root.FES.ZONES = [
    { key: 'A', label: 'A 区' },
    { key: 'B', label: 'B 区' },
    { key: 'C', label: 'C 区' },
    { key: 'D', label: 'D 区' }
  ];

  /* 阵营与代理人：顺序与游戏内「阵营」列表一致 */
  root.FES.CAMPS = [
    {
      key: 'cunning-hare', label: '狡兔屋',
      agents: [
        { key: 'anby', label: '安比' },
        { key: 'nekomata', label: '猫宫又奈' },
        { key: 'nicole', label: '妮可' },
        { key: 'billy', label: '比利' }
      ]
    },
    {
      key: 'belobog', label: '白祇重工',
      agents: [
        { key: 'koleda', label: '珂蕾妲' },
        { key: 'anton', label: '安东' },
        { key: 'ben', label: '本' },
        { key: 'grace', label: '格莉丝' }
      ]
    },
    {
      key: 'victoria', label: '维多利亚家政',
      agents: [
        { key: 'corin', label: '可琳' },
        { key: 'lycaon', label: '莱卡恩' },
        { key: 'ellen', label: '艾莲' },
        { key: 'rina', label: '丽娜' }
      ]
    },
    {
      key: 'obol', label: '奥波勒斯小队',
      agents: [
        { key: 'soldier11', label: '11 号' },
        { key: 'orphie', label: '奥菲丝&鬼火' },
        { key: 'trigger', label: '扳机' },
        { key: 'seed', label: '席德' }
      ]
    },
    {
      key: 'criminal', label: '刑侦特勤组',
      agents: [
        { key: 'zhuyuan', label: '朱鸢' },
        { key: 'qingyi', label: '青衣' },
        { key: 'jane', label: '简' },
        { key: 'seth', label: '赛斯' }
      ]
    },
    {
      key: 'calydon', label: '卡吕冬之子',
      agents: [
        { key: 'caesar', label: '凯撒' },
        { key: 'luciana', label: '露西亚娜' },
        { key: 'lighter', label: '莱特' },
        { key: 'burnice', label: '柏妮思' },
        { key: 'piper', label: '派派' }
      ]
    },
    {
      key: 'section6', label: '对空六课',
      agents: [
        { key: 'miyabi', label: '星见雅' },
        { key: 'soukaku', label: '苍角' },
        { key: 'harumasa', label: '浅羽悠真' },
        { key: 'yanagi', label: '月城柳' }
      ]
    },
    {
      key: 'lyra', label: '天琴座',
      agents: [
        { key: 'astra', label: '耀嘉音' },
        { key: 'evelyn', label: '伊芙琳' }
      ]
    },
    {
      key: 'mockingbird', label: '反舌鸟',
      agents: [
        { key: 'hugo', label: '雨果' },
        { key: 'vivian', label: '薇薇安' }
      ]
    },
    {
      key: 'yunkui', label: '云岿山',
      agents: [
        { key: 'yixuan', label: '仪玄' },
        { key: 'jufufu', label: '橘福福' },
        { key: 'panyinhu', label: '潘引壶' },
        { key: 'yeshunguang', label: '叶瞬光' }
      ]
    },
    {
      key: 'spookshack', label: '怪啖屋',
      agents: [
        { key: 'yidhari', label: '伊德海莉' },
        { key: 'alice', label: '爱丽丝' },
        { key: 'yuzuha', label: '浮波柚叶' },
        { key: 'manato', label: '狛野真斗' },
        { key: 'lucia', label: '卢西娅' }
      ]
    },
    {
      key: 'krampus', label: '坎卜斯黑枝',
      agents: [
        { key: 'zhao', label: '照' },
        { key: 'banyue', label: '般岳' },
        { key: 'liuyin', label: '琉音' },
        { key: 'promelia', label: '普罗米娅' },
        { key: 'fione', label: '菲欧妮' }
      ]
    },
    {
      key: 'fantasyangel', label: '妄想天使',
      agents: [
        { key: 'sunna', label: '千夏' },
        { key: 'aria', label: '爱芮' },
        { key: 'nangongyu', label: '南宫羽' }
      ]
    },
    {
      key: 'urbanorder', label: '都市秩序部',
      agents: [
        { key: 'cissia', label: '希希芙' },
        { key: 'severian', label: '塞维里安' }
      ]
    },
    {
      key: 'foreignoffice', label: '外务筹策局',
      agents: [
        { key: 'velina', label: '维琳娜' },
        { key: 'norma', label: '诺姆' }
      ]
    },
    {
      key: 'dashi', label: '达识结社',
      agents: [
        { key: 'remielle', label: '蕾米埃尔' }
      ]
    },
    {
      key: 'skyward', label: '空巡局',
      agents: [
        { key: 'sigrid', label: '希格莉德' }
      ]
    },
    {
      key: 'flint', label: '弗林特工坊',
      agents: [
        { key: 'claret', label: '克拉蕾' },
        { key: 'roxy', label: '洛克茜' }
      ]
    },
    {
      key: 'other', label: '其他',
      agents: [
        { key: 'peloyis', label: '佩洛伊斯' },
        { key: 'ling', label: '铃' },
        { key: 'zhe', label: '哲' },
        { key: 'lindwein', label: '林德薇恩' },
        { key: 'elda', label: '艾尔妲' },
        { key: 'drechina', label: '德蕾琪娜' }
      ]
    }
  ];

  /* 摊位状态标签：用于「能否预约」「是否限购」这类现场决策 */
  root.FES.TAGS = ['预约', '限购', '售罄', '可代购'];

  /* 扁平索引：agentKey -> { key, label, campKey, campLabel } */
  const AGENT_MAP = {};
  root.FES.CAMPS.forEach(function (camp) {
    camp.agents.forEach(function (agent) {
      AGENT_MAP[agent.key] = {
        key: agent.key,
        label: agent.label,
        campKey: camp.key,
        campLabel: camp.label
      };
    });
  });
  root.FES.AGENT_MAP = AGENT_MAP;

  root.FES.agentLabel = function (key) {
    const found = AGENT_MAP[key];
    return found ? found.label : (key || '其他');
  };

  root.FES.campOfAgent = function (key) {
    const found = AGENT_MAP[key];
    return found ? found.campKey : null;
  };

  root.FES.campLabel = function (key) {
    const found = root.FES.CAMPS.filter(function (c) { return c.key === key; })[0];
    return found ? found.label : (key || '其他');
  };

  root.FES.zoneOf = function (id) {
    return id ? String(id).charAt(0) : '';
  };

  root.FES.isValidTag = function (tag) {
    return root.FES.TAGS.indexOf(tag) !== -1;
  };
})(window);
