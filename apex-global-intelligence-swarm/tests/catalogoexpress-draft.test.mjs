import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../productos/catalogoexpress/app.mjs',import.meta.url),'utf8');
const start=source.indexOf('function preview(){');
const end=source.indexOf('\nfunction addInput(',start);
assert.ok(start>=0 && end>start,'Preview function must be present');
const previewFunction=source.slice(start,end);

function exercisePreview(buildPage) {
  let saved=0;
  let rendered='';
  let message='';
  const elements={preview:{set srcdoc(html){rendered=html;}}};
  const context={
    pull(){},
    persist(){saved++;},
    buildPage,
    $:id=>elements[id],
    notify:value=>{message=value;}
  };
  vm.runInNewContext(previewFunction+'\npreview();',context);
  return {saved,rendered,message};
}

test('invalid edits do not overwrite the last recoverable catalog',()=>{
  const result=exercisePreview(()=>{throw new Error('Precio obligatorio');});
  assert.equal(result.saved,0);
  assert.equal(result.rendered,'');
  assert.equal(result.message,'Precio obligatorio');
});

test('a valid preview is rendered and saved exactly once',()=>{
  const result=exercisePreview(()=>'<html>Valid catalog</html>');
  assert.equal(result.saved,1);
  assert.equal(result.rendered,'<html>Valid catalog</html>');
  assert.equal(result.message,'');
});
