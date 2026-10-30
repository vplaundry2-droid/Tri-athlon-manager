import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('source audit contains all 116 unique entries without personal file paths',async()=>{
  const text=await readFile(new URL('../SOURCE_COVERAGE.md',import.meta.url),'utf8');
  const ids=[...text.matchAll(/^\| (\d{3}) \|/gm)].map(m=>+m[1]);
  assert.deepEqual(ids,Array.from({length:116},(_,i)=>i+1));assert.doesNotMatch(text,/C:\\Users|Printed by:/i);assert.match(text,/full book.*not present/);
});
