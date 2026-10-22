import { mkdir,copyFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('dist/',root),{recursive:true});
for(const file of ['index.html','styles.css','components.css','app.js','core.js','engine.js'])await copyFile(new URL('public/'+file,root),new URL('dist/'+file,root));
console.log('Static app built in dist/. Optional AI needs the local Node server; no secrets are included.');
