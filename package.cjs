const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = __dirname;
const code = fs.readFileSync(path.join(root, 'blackwing-summoner.js'), 'utf8');
const id = '8ea1ae67-9ee1-4db9-ae4f-4eac12fca73b';
const url = 'https://cdn.jsdelivr.net/gh/qq85316902-cloud/nga@main/blackwing-summoner.js';
const loader = `// 从自己的仓库加载黑翼召唤器模块；必须导入酒馆助手脚本库并启用。\n$(async () => {\n  try {\n    await import('${url}');\n  } catch (error) {\n    console.error('[黑翼召唤器仓库加载]', error);\n    toastr.error('装备模块加载失败：请检查网络、仓库文件和CDN，或改用本地版导入JSON');\n  }\n});\n`;
const make = (content, name, info) => ({
  type: 'script', enabled: true, name, id, content, info,
  button: { enabled: true, buttons: [{ name: '发放并修复黑翼召唤器', visible: true }] }, data: {}
});
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
};
write(path.join(root, 'blackwing-remote.json'), make(loader, '黑翼召唤器·仓库加载版', '从qq85316902-cloud/nga加载。仅菲娜，主手绑定，按装备生成规则自动成长。先停用旧版黑翼修复脚本。'));
write(path.join(root, 'blackwing-local.json'), make(code, '黑翼召唤器·装备规则本地版', '完整内置代码。与仓库加载版二选一；先停用旧版黑翼修复脚本。'));
const context = vm.createContext({ console });
vm.runInContext(code, context);
write(path.join(root, 'blackwing-level-1.json'), context.NgaBlackwing.buildWeapon(1));
console.log('已生成远程导入、本地导入和1级装备示例。');
