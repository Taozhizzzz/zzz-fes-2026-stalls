/* ============================================================
   站点元数据：分区、制品类型枚举、状态标签
   ------------------------------------------------------------
   · 这里的 TYPES 是「枚举」而不是自由文本，这是全站可按类型
     做全局筛选的前提。录入制品时 type 必须填下面的 key。
   · 新增一个类型只需在 TYPES 里追加一项，筛选器与标签会自动出现。
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

  /* 制品类型枚举：key 写进数据，label 用于展示 */
  root.FES.TYPES = [
    { key: 'badge', label: '徽章' },
    { key: 'stand', label: '立牌' },
    { key: 'charm', label: '挂件' },
    { key: 'card', label: '小卡' },
    { key: 'book', label: '本子' },
    { key: 'plush', label: '毛绒' },
    { key: 'apparel', label: '服饰' },
    { key: 'other', label: '其他' }
  ];

  /* 摊位状态标签：用于「能否预约」「是否限购」这类现场决策 */
  root.FES.TAGS = ['预约', '限购', '售罄', '可代购'];

  const TYPES = root.FES.TYPES;
  const TAGS = root.FES.TAGS;

  root.FES.typeLabel = function (key) {
    const found = TYPES.filter(function (t) { return t.key === key; })[0];
    return found ? found.label : (key || '其他');
  };

  root.FES.zoneLabel = function (key) {
    return key ? key + ' 区' : '';
  };

  root.FES.zoneOf = function (id) {
    return id ? String(id).charAt(0) : '';
  };

  root.FES.isValidTag = function (tag) {
    return TAGS.indexOf(tag) !== -1;
  };
})(window);
