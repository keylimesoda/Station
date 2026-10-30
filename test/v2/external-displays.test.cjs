const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const Grid = require('../../lib/Grid.js');
const Store = require('../../lib/Store.js');
const source = readFileSync('Service.qml', 'utf8');
function method(name, context) {
  const start = source.indexOf('  function ' + name + '(');
  const end = source.indexOf('\n  function ', start + 1);
  assert.ok(start >= 0 && end > start);
  return runInNewContext('(' + source.slice(start, end).trim() + ')', context);
}
test('external displays are opt-in and persist as a strict boolean', () => {
  assert.equal(Store.loadConfig({}).externalDisplays, false);
  assert.equal(Store.loadConfig({ externalDisplays: true }).externalDisplays, true);
  assert.equal(Store.loadConfig({ externalDisplays: 'true' }).externalDisplays, false);
});
test('external mode rejects every display editing entry point before effects', () => {
  for (const name of ['setDisplayValue', 'setResizedDisplayValue', 'setDisplayTransform',
    'applyDisplaySetting', 'setDisplayEnabled', 'setDisplayPosition', 'setModeValue', 'previewLayout']) {
    const c = { config: { externalDisplays: true }, draftEditable: true };
    assert.equal(method(name, c)('HDMI-A-1', 0, 0), 'external-display-manager', name);
  }
});
test('startup and hotplug reconcile workspaces without applying monitor rules', () => {
  let reconciles = 0, binds = 0, blur = 0, assignments = 0;
  const c = { config: { externalDisplays: true }, state: 'idle',
    updateAssignments() { assignments++; }, reconcile() { reconciles++; },
    applyBinds() { binds++; }, syncBarBlur() { blur++; } };
  method('applyRuntime', c)();
  assert.deepEqual([assignments, reconciles, binds, blur], [1, 1, 1, 1]);
});
test('external topology uses active non-mirrored displays, not saved Station mode', () => {
  const c = { Grid, config: { externalDisplays: true, mode: 'single', singleTarget: 'A', enabled: ['A'] },
    state: 'idle', previewApplied: null, lanes: { A: 1, B: 2, C: 3 },
    monitors: [{ name: 'A', mirrorOf: 'none' }, { name: 'B', mirrorOf: 'none' },
      { name: 'C', mirrorOf: 'A' }] };
  assert.equal(JSON.stringify(method('targetMapping', c)()), JSON.stringify({ outputs: ['A', 'B'] }));
  c.monitors[1].disabled = true;
  assert.equal(JSON.stringify(method('targetMapping', c)()), JSON.stringify({ outputs: ['A'] }));
});
