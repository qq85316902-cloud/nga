const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code = JSON.parse(fs.readFileSync(__dirname + '/blackwing-user-night-helper.json', 'utf8')).content;
const clone = value => JSON.parse(JSON.stringify(value));
async function runtime(name, noSave = false, absentMvu = false) {
  let saved = { stat_data: { 人物: { 名称: name, 等级: 1, 属性: { 体质: 10 }, 装备列表: {}, 技能树: { 技能列表: {} } } } };
  const handlers = new Map(), init = [], notice = [], errors = [];
  const on = (event, fn) => handlers.set(event, [...(handlers.get(event) || []), fn]);
  const ctx = { console: { log() {}, warn() {}, error: (...args) => errors.push(args) }, window: {},
    _: { isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
    toastr: Object.fromEntries(['info', 'warning', 'success', 'error'].map(kind => [kind, message => notice.push({kind, message})])),
    $: fn => init.push(Promise.resolve().then(fn)),
    waitGlobalInitialized: absentMvu ? () => new Promise(() => {}) : async () => {},
    eventOn: on, eventOnButton: on,
    eventMakeLast: (event, fn) => { handlers.set(event, (handlers.get(event) || []).filter(x => x !== fn)); on(event, fn); }
  };
  if (!absentMvu) ctx.Mvu = { events: { VARIABLE_UPDATE_STARTED: 'start', VARIABLE_UPDATE_ENDED: 'end' },
    getMvuData: () => clone(saved), replaceMvuData: async data => { if (!noSave) saved = clone(data); } };
  vm.runInContext(code, vm.createContext(ctx));
  if (!absentMvu) while (init.length) await Promise.all(init.splice(0));
  return { notice, errors, read: () => saved, press: async label => { for (const fn of handlers.get(label) || []) await fn(); }, handlers };
}
(async () => {
  for (const name of ['小明','菲娜','user','']) {
  const okay=await runtime(name);await okay.press('发放并校验黑翼召唤器');const p=okay.read().stat_data.人物;
  assert.equal(p.装备列表.黑翼召唤器.绑定者,'user');assert.equal(Object.keys(p.资源技能).length,4);assert.equal(p.资源技能.武器降临.次数上限,2);assert.equal(p.资源技能.声波降临.次数上限,2);assert.equal(p.资源技能.契约降临.次数上限,1);assert.equal(p.资源技能.最终降临.品质,'卓越');
  p.资源技能.声波降临.剩余次数=0;p.资源技能.测试技能={剩余次数:3};const originalTree=JSON.stringify(p.技能树);await okay.press('发放并校验黑翼召唤器');assert.equal(okay.read().stat_data.人物.资源技能.声波降临.剩余次数,0);assert.deepEqual(okay.read().stat_data.人物.资源技能.测试技能,{剩余次数:3});assert.equal(JSON.stringify(okay.read().stat_data.人物.技能树),originalTree);
  }
  const failed = await runtime('菲娜', true);
  await failed.press('发放并校验黑翼召唤器');
  assert.ok(failed.notice.some(x => x.kind === 'error' && /保存后校验失败/.test(x.message)));
  assert.ok(!failed.notice.some(x => x.message.includes('已确认存档写入')));
  const absent = await runtime('菲娜', false, true);
  assert.ok(absent.handlers.has('检查黑翼发放状态'), '等待MVU前已有检查按钮');
  await absent.press('检查黑翼发放状态');
  assert.ok(absent.notice.some(x => x.kind === 'warning' && x.message.includes('MVU尚未加载')));
  const okay = await runtime('菲娜');
  await okay.press('发放并校验黑翼召唤器');
  assert.ok(okay.notice.some(x => x.kind === 'success' && x.message.includes('已确认存档写入')));
  assert.equal(okay.read().stat_data.人物.装备列表.黑翼召唤器.装备箱, false);
  console.log('通过：四技能自动登记、任意玩家、重复导入不补次数、不改其他技能及技能树、写入失败校验、无MVU检查。');
})().catch(error => { console.error(error); process.exitCode = 1; });
