const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const code = fs.readFileSync(path.join(__dirname, 'blackwing-summoner.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const context = vm.createContext({ console });
vm.runInContext(code, context);
const api = context.NgaBlackwing;
const fixture = (name = '菲娜', level = 1) => ({ stat_data: { 人物: {
  名称: name, 等级: level, 特质: {}, 技能树: null, 资源技能: {}, 装备列表: {
    旧剑: { 名称: '旧剑', 类型: '武器', 部位: '主手', 装备箱: false },
    戒指: { 名称: '戒指', 类型: '首饰', 部位: '手指', 装备箱: false }
  }
} }, other: 'preserve' });

test('所有等级符合基础品质、品质上限、六维预算、词条数量和伤害系数', () => {
  const six = ['力量', '敏捷', '体质', '智力', '感知', '魅力'];
  const allowed = [...six, '暴击率', '暴击伤害', '物理减伤', '魔法减伤', '生命值上限', '基础', '转职', '进阶', '必杀', '奥义', '觉醒一', '觉醒二', '觉醒三', '全技能'];
  for (let level = 1; level <= 100; level++) {
    const w = api.buildWeapon(level), band = api.bandFor(level), b = api.BUDGETS[w.品质];
    assert.equal(w.品质, band.base);
    assert.ok(api.QUALITY.indexOf(w.品质) <= api.QUALITY.indexOf(band.cap));
    assert.equal(w.效果.split(';').filter(e => /^\[/.test(e)).length, b.count);
    assert.equal((w.效果.match(/\[[^\]]+\](?:每战|当)/g) || []).length, b.count);
    let sum = 0;
    for (const [key, value] of Object.entries(w.属性加成)) {
      assert.ok(allowed.includes(key));
      if (six.includes(key)) { sum += value; assert.ok(value <= b.single); }
    }
    assert.ok(sum <= b.total);
    assert.equal(w.属性加成.生命值上限, undefined);
    assert.doesNotMatch(w.效果, /AC|全技能|觉醒三|暴击率|生存形态|生存卡组/);
    assert.match(w.效果, new RegExp(`\\[${b.damage}% \\+ ${b.growth}% × \\(玩家等级 - 1\\)\\]`));
    assert.match(w.效果, /结算结果×60%/);
    assert.match(w.效果, /每战1次，消耗1次攻击次数/);
    assert.ok([...w.描述].length <= 30);
    assert.equal((w.描述.match(/。/g) || []).length, 1);
    if (b.dc === null) assert.doesNotMatch(w.效果, /DC\d+/);
    else assert.match(w.效果, new RegExp(`DC${b.dc}敏捷豁免，成功伤害减半`));
  }
  assert.equal(api.buildWeapon(18).品质, '普通');
  assert.equal(api.buildWeapon(19).品质, '精良');
  assert.equal(api.buildWeapon(35).品质, '稀有');
  assert.equal(api.buildWeapon(50).品质, '稀有');
  assert.equal(api.buildWeapon(75).品质, '卓越');
  assert.equal(api.buildWeapon(90).品质, '传说');
  assert.equal(api.buildWeapon(100).品质, '史诗');
  assert.equal(api.buildWeapon(1000).等级, 100);
});

test('发放只修改菲娜装备与面板，原主手转存，重复执行无变化', () => {
  const data = fixture();
  const result = api.synchronize(data);
  assert.equal(result.changed, true);
  const p = data.stat_data.人物;
  assert.equal(p.装备列表.黑翼召唤器.装备箱, false);
  assert.equal(p.装备列表.黑翼召唤器.绑定者, '菲娜');
  assert.equal(p.装备列表.旧剑.装备箱, true);
  assert.equal(p.装备列表.戒指.装备箱, false);
  assert.deepEqual(p.特质, {});
  assert.equal(p.技能树, null);
  assert.deepEqual(p.资源技能, {});
  assert.equal(data.other, 'preserve');
  assert.equal(api.synchronize(data).changed, false);
  const other = fixture('夜斗');
  const original = plain(other);
  assert.equal(api.synchronize(other).skipped, true);
  assert.deepEqual(other, original);
});

test('修复旧版本品质和词条，保留强化、冷却和卡片使用记录', () => {
  const data = fixture('菲娜', 75);
  data.stat_data.人物.装备列表.oldKey = {
    名称: '黑翼召唤器', 类型: '神器·翼召剑', 品质: '神话', 等级: 1,
    属性加成: { AC: 20, 力量: 999 }, 效果: '[旧词条]无限召唤',
    冷却计数: 3, 剩余次数: 0, 使用记录: { 读卡: true }, 强化等级: 2
  };
  api.synchronize(data);
  const w = data.stat_data.人物.装备列表.oldKey;
  assert.equal(w.品质, '卓越');
  assert.equal(w.等级, 75);
  assert.equal(w.强化等级, 2);
  assert.equal(w.冷却计数, 3);
  assert.equal(w.剩余次数, 0);
  assert.deepEqual(w.使用记录, { 读卡: true });
  assert.deepEqual(plain(w.属性加成), { 敏捷: 1, 感知: 1, 基础: 1 });
  assert.equal(data.stat_data.人物.装备列表.黑翼召唤器, undefined);
});

test('错误数据与重名冲突在修改前拒绝，不删除玩家物品', () => {
  for (const bad of [[], 'broken']) {
    const data = fixture(); data.stat_data.人物.装备列表 = bad;
    const before = plain(data);
    assert.throws(() => api.synchronize(data), /不是对象/);
    assert.deepEqual(data, before);
  }
  const data = fixture();
  data.stat_data.人物.装备列表.黑翼召唤器 = { 名称: '其他物品' };
  const before = plain(data);
  assert.throws(() => api.synchronize(data), /键名/);
  assert.deepEqual(data, before);
  data.stat_data.人物.装备列表.黑翼召唤器 = { 名称: '黑翼召唤器' };
  data.stat_data.人物.装备列表.副本 = { 名称: '黑翼召唤器' };
  const duplicate = plain(data);
  assert.throws(() => api.synchronize(data), /多件/);
  assert.deepEqual(data, duplicate);
});

test('启动在原新增装备守卫之后执行，升级保留使用状态，保存后重新校验', async () => {
  let saved = fixture(), writes = 0;
  const events = new Map(), init = [], errors = [];
  const on = (event, fn) => events.set(event, [...(events.get(event) || []), fn]);
  const last = (event, fn) => { events.set(event, (events.get(event) || []).filter(x => x !== fn)); on(event, fn); };
  const guard = (next, before) => {
    for (const [key, w] of Object.entries(next.stat_data.人物.装备列表)) {
      if (!before.stat_data.人物.装备列表[key]) w.装备箱 = true;
    }
  };
  on('ended', guard);
  const runtime = vm.createContext({
    console: { error: (...args) => errors.push(args) },
    $: fn => init.push(Promise.resolve().then(fn)), waitGlobalInitialized: async () => {},
    eventOn: on, eventMakeLast: last, eventOnButton: on, tavern_events: { CHAT_CHANGED: 'chat' },
    toastr: { info() {}, success() {}, error: (...args) => errors.push(args) },
    Mvu: { events: { VARIABLE_INITIALIZED: 'init', VARIABLE_UPDATE_STARTED: 'started', VARIABLE_UPDATE_ENDED: 'ended' },
      getMvuData: () => plain(saved), replaceMvuData: async next => {
        for (const fn of events.get('ended')) await fn(next, saved);
        saved = plain(next); writes++;
      }
    }
  });
  vm.runInContext(code, runtime);
  await Promise.all(init);
  assert.equal(saved.stat_data.人物.装备列表.黑翼召唤器.装备箱, false);
  assert.equal(writes, 1);
  const next = plain(saved);
  next.stat_data.人物.等级 = 90;
  next.stat_data.人物.装备列表.黑翼召唤器.剩余次数 = 0;
  on('ended', guard); // 模拟后注册的原辅助脚本；started应把同步放回最后。
  for (const fn of events.get('started')) await fn();
  for (const fn of events.get('ended')) await fn(next, saved);
  saved = plain(next);
  assert.equal(saved.stat_data.人物.装备列表.黑翼召唤器.品质, '传说');
  assert.equal(saved.stat_data.人物.装备列表.黑翼召唤器.剩余次数, 0);
  vm.runInContext(code, runtime); // 重复加载不重复注册。
  assert.equal(events.get('ended').filter(x => x !== guard).length, 1);
  await runtime.NgaBlackwing.repairCurrent(false);
  assert.equal(writes, 1);
  assert.equal(errors.length, 0);
});
