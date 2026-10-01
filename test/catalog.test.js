import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, buildCatalog } from '../scripts/build-catalog.mjs';

test('parseCsv klarar citat och kommatecken', () => {
  const rows = parseCsv('set_num,name,year\n10305-1,"Lion Knights\' Castle",2022\n7-1,"Tea, ""Party""",1960\n');
  assert.deepEqual(rows, [
    { set_num: '10305-1', name: "Lion Knights' Castle", year: '2022' },
    { set_num: '7-1', name: 'Tea, "Party"', year: '1960' },
  ]);
});

test('buildCatalog: rot-tema, filtrerar bort icke-set, kompakt format', () => {
  const themes = 'id,name,parent_id\n158,Star Wars,\n171,Ultimate Collector Series,158\n721,Icons,\n';
  const sets = [
    'set_num,name,year,theme_id,num_parts,img_url',
    '75192-1,Millennium Falcon,2017,171,7541,x',
    '10305-1,Lion Knights\' Castle,2022,721,4515,x',
    '5005254-1,Key Chain,2018,721,0,x',
    'fig-000001,Minifig,2020,158,4,x',
  ].join('\n');
  const c = buildCatalog(sets, themes);
  assert.deepEqual(c.themes, ['Icons', 'Star Wars']);
  assert.deepEqual(c.sets, [
    ['10305-1', "Lion Knights' Castle", 2022, 0, 4515],
    ['75192-1', 'Millennium Falcon', 2017, 1, 7541],
  ]);
});
