import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('search ignores accents and case, requires every term and treats markup as literal text',()=>{
 const context={window:{},document:{querySelector:()=>null}};vm.runInNewContext(readFileSync('assets/pesquisa.js','utf8'),context);
 const {matches}=context.window.MedQuestSearchModel;
 assert.equal(matches({search:'Parasitologia Protozoários cavitários Entamoebas'},'PROTOZOARIOS parasitologia'),true);
 assert.equal(matches({search:'Microbiologia Biofilmes'},'biofilmes imunologia'),false);
 assert.equal(matches({search:'<img src=x>'},'<img'),true);
});
