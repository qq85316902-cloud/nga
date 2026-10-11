/** 黑翼召唤器：创世回廊 / 酒馆助手 / MVU。仅发放给菲娜。
 * 品质按装备生成规则的基础档成长；效果、属性预算按品质同步。
 * 战斗效果由游戏按装备规则结算；此模块负责装备数据和自动成长。
 */
(() => {
  'use strict';
  if (globalThis.NgaBlackwing?.version === '1.0.0') return;
  const OWNER = '菲娜';
  const NAME = '黑翼召唤器';
  const BUTTON = '发放并修复黑翼召唤器';
  const OPTIONS = { type: 'message', message_id: 'latest' };
  const QUALITY = ['普通', '精良', '稀有', '卓越', '传说', '史诗', '神话'];
  const BANDS = [
    { min: 1, max: 18, base: '普通', cap: '稀有' },
    { min: 19, max: 34, base: '精良', cap: '卓越' },
    { min: 35, max: 49, base: '稀有', cap: '卓越' },
    { min: 50, max: 74, base: '稀有', cap: '传说' },
    { min: 75, max: 89, base: '卓越', cap: '史诗' },
    { min: 90, max: 99, base: '传说', cap: '神话' },
    { min: 100, max: 100, base: '史诗', cap: '神话' }
  ];
  const BUDGETS = {
    普通: { count: 1, total: 0, single: 0, damage: 130, growth: 1, dc: null, shield: 0, dice: '1d6', attrs: {} },
    精良: { count: 1, total: 1, single: 1, damage: 150, growth: 1.5, dc: null, shield: 0, dice: '1d8', attrs: { 敏捷: 1 } },
    稀有: { count: 2, total: 1, single: 1, damage: 170, growth: 2, dc: 12, shield: 10, dice: '2d8', attrs: { 敏捷: 1, 基础: 1 } },
    卓越: { count: 2, total: 2, single: 1, damage: 200, growth: 2.5, dc: 15, shield: 15, dice: '2d10', attrs: { 敏捷: 1, 感知: 1, 基础: 1 } },
    传说: { count: 3, total: 2, single: 2, damage: 240, growth: 3, dc: 16, shield: 25, dice: '3d12', attrs: { 敏捷: 2, 基础: 1, 必杀: 1 } },
    史诗: { count: 3, total: 3, single: 2, damage: 280, growth: 4, dc: 18, shield: 40, dice: '4d10', attrs: { 敏捷: 2, 感知: 1, 全技能: 2 } },
    神话: { count: 3, total: 4, single: 3, damage: 320, growth: 5, dc: 20, shield: 60, dice: '4d12', attrs: { 敏捷: 3, 感知: 1, 全技能: 2, 觉醒三: 1 } }
  };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  };
  const clampLevel = value => Math.max(1, Math.min(100, integer(value, 1)));
  const bandFor = level => BANDS.find(b => clampLevel(level) >= b.min && clampLevel(level) <= b.max);

  function buildEffects(quality) {
    const b = BUDGETS[quality];
    const formula = `[${b.damage}% + ${b.growth}% × (玩家等级 - 1)]`;
    // 普通/精良没有装备豁免DC预算，不能通过卡片绕过此限制。
    const limits = b.dc === null
      ? '本品质只承载单体伤害或无数值增益的非战斗交互，不承载范围伤害、治疗、护盾或敌方状态'
      : `范围伤害卡最多覆盖目标点周围5尺，且须位于自身30尺内，范围内目标进行DC${b.dc}敏捷豁免，成功伤害减半并免疫附加控制；治疗或护盾卡只作用于自身或30尺内可见的一名友方，恢复量或护盾量不超过目标生命值上限×${b.shield}%，护盾持续至菲娜下一回合开始；状态卡只作用于30尺内可见的一名敌人，最多施加卡面记载的一种状态，持续1轮，目标进行DC${b.dc}对应属性豁免，成功无效果，力量抗推拉或束缚、体质抗毒或眩晕、智力抗幻术、感知抗魅惑或恐惧、魅力抗放逐或支配`;
    const effects = [
      `[翼召读卡]每战1次，消耗1次攻击次数，菲娜无需变身，将实际持有且有剩余次数的有效卡片插入主手召唤器，读卡槽以机械音播报卡名后发动，只选择卡面的一项能力，伤害卡结算一次${formula}伤害，单体目标须在自身30尺内且可见，使用攻击检定命中；若卡片记载契约兽技能，对应契约兽短暂现身施放同一技能，伤害、治疗或护盾结算结果×60%，施放完毕后立即消失且没有独立行动；${limits}；非战斗交互仅处理卡面明确记载的探索动作，无战斗收益或检定加值。伤害类型按卡面，卡片与召唤器各扣一次使用次数，实际倍率、范围、次数取卡片和装备限制中更严格者，同类加值取最高，不承载免死、额外回合或长期免疫，不能叠加卡片另一次伤害或其他额外收益。武器仅绑定菲娜，由脚本随其等级成长，不附送卡片`
    ];
    if (b.count >= 2) {
      effects.push(`[翼幕回护]每战1次，当菲娜将受到一次命中伤害时，消耗反应，合拢黑翼护手生成护盾，吸收本次伤害，护盾量为自身生命值上限×${b.shield}%，本次伤害结算完毕后余量消散，同类护盾取最高`);
    }
    if (b.count >= 3) {
      effects.push('[暗翼循迹]当菲娜在非战斗探索中追踪已读卡片对应契约兽留下的足迹时触发，护手浮现暗翼纹路，追踪足迹的感知检定+2，不提供战斗收益，同类加值取最高');
    }
    return effects.join(';');
  }

  function buildWeapon(level, previous = {}) {
    const lv = clampLevel(level);
    const quality = bandFor(lv).base;
    const b = BUDGETS[quality];
    const enhancement = Math.max(0, integer(previous.强化等级, 0));
    // 初始装备不因专属身份获得满品级；保留已有合法品级和强化。
    const grade = Math.max(-10, Math.min(10, integer(previous.品级, 0)));
    return {
      ...previous,
      类型: '武器', 部位: '主手', 名称: NAME, 绑定者: OWNER,
      装备箱: false, 品质: quality, 等级: lv,
      强化等级: enhancement, 品级: grade,
      属性加成: { ...b.attrs },
      效果: buildEffects(quality),
      描述: '蝙蝠翼护手环绕漆黑剑身，卡槽泛着幽紫微光。',
      // 兼容现有辅助计算脚本的武器面板，不另加专属数值。
      伤害骰: b.dice,
      等级系数: Math.floor(lv / 10) + 1,
      固定伤害: Math.floor(lv * (1 + enhancement * 0.1) * (1 + grade / 100))
    };
  }

  function synchronize(data) {
    const player = data?.stat_data?.人物;
    if (!object(player) || String(player.名称 ?? '').trim() !== OWNER) return { skipped: true };
    if (player.装备列表 != null && !object(player.装备列表)) throw new Error('人物.装备列表不是对象，停止写入');
    if (player.战斗属性 != null && !object(player.战斗属性)) throw new Error('人物.战斗属性不是对象，停止写入');
    const list = player.装备列表 ?? {};
    const matches = Object.entries(list).filter(([, item]) => object(item) && String(item.名称 ?? '').trim() === NAME);
    // 发现重复时不删除玩家数据，也不把多份绑定武器同时装备。
    if (matches.length > 1) throw new Error('发现多件黑翼召唤器，请先合并重复装备，再运行修复');
    const key = matches[0]?.[0] ?? NAME;
    if (!matches.length && Object.hasOwn(list, key)) throw new Error('黑翼召唤器键名被其他装备占用，停止写入');
    const before = JSON.stringify({ list: player.装备列表, panel: player.战斗属性?.武器面板 });
    const weapon = buildWeapon(player.等级, matches[0]?.[1]);
    for (const [otherKey, item] of Object.entries(list)) {
      if (otherKey !== key && object(item) && item.类型 === '武器' && item.部位 === '主手' && item.装备箱 === false) {
        item.装备箱 = true;
      }
    }
    list[key] = weapon;
    player.装备列表 = list;
    if (!player.战斗属性) player.战斗属性 = {};
    player.战斗属性.武器面板 = {
      伤害骰: weapon.伤害骰, 等级系数: weapon.等级系数, 固定伤害: weapon.固定伤害
    };
    const after = JSON.stringify({ list, panel: player.战斗属性.武器面板 });
    return { changed: before !== after, level: weapon.等级, quality: weapon.品质 };
  }

  async function repairCurrent(showStatus = true) {
    const data = Mvu.getMvuData(OPTIONS);
    const result = synchronize(data);
    if (result.skipped) {
      if (showStatus) toastr.info('当前存档主角须命名为菲娜，且已初始化人物变量');
      return result;
    }
    if (result.changed) await Mvu.replaceMvuData(data, OPTIONS);
    const saved = Mvu.getMvuData(OPTIONS);
    const player = saved?.stat_data?.人物;
    const weapon = Object.values(player?.装备列表 ?? {}).find(item => object(item) && item.名称 === NAME);
    const expected = buildWeapon(player?.等级, weapon);
    if (String(player?.名称 ?? '').trim() !== OWNER || !weapon || weapon.装备箱 !== false
        || weapon.部位 !== '主手' || weapon.类型 !== '武器'
        || weapon.等级 !== expected.等级 || weapon.品质 !== expected.品质
        || weapon.效果 !== expected.效果 || JSON.stringify(weapon.属性加成) !== JSON.stringify(expected.属性加成)) {
      throw new Error('保存后装备校验失败，请检查其他脚本是否覆盖装备');
    }
    if (showStatus) toastr.success(`${NAME}已装备：Lv.${weapon.等级} ${weapon.品质}`);
    return result;
  }

  function onUpdate(data) {
    try { synchronize(data); }
    catch (error) { console.error('[黑翼召唤器]', error); }
  }
  function scheduleLast() { eventMakeLast(Mvu.events.VARIABLE_UPDATE_ENDED, onUpdate); }
  async function manualRepair() {
    try { scheduleLast(); await repairCurrent(true); }
    catch (error) { console.error('[黑翼召唤器]', error); toastr.error(error.message); }
  }
  async function start() {
    await waitGlobalInitialized('Mvu');
    if (typeof Mvu.getMvuData !== 'function' || typeof Mvu.replaceMvuData !== 'function') throw new Error('MVU缺少装备存档接口');
    // 在原装备新增守卫和计算之后执行，保证新武器不会被转回装备箱。
    scheduleLast();
    eventMakeLast(Mvu.events.VARIABLE_INITIALIZED, onUpdate);
    eventOn(Mvu.events.VARIABLE_UPDATE_STARTED, scheduleLast);
    eventOn(tavern_events.CHAT_CHANGED, manualRepair);
    eventOnButton(BUTTON, manualRepair);
    await repairCurrent(false);
  }
  globalThis.NgaBlackwing = Object.freeze({
    version: '1.0.0', OWNER, NAME, BUTTON, QUALITY, BANDS, BUDGETS,
    bandFor, buildWeapon, buildEffects, synchronize, repairCurrent
  });
  if (typeof $ === 'function' && typeof waitGlobalInitialized === 'function') {
    $(async () => {
      try { await start(); }
      catch (error) { console.error('[黑翼召唤器]', error); toastr.error(error.message); }
    });
  }
})();
