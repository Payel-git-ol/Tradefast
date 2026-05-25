import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ansi = readFileSync(new URL('./frame.ansi', import.meta.url), 'utf8');

// --- Minimal ANSI SGR -> HTML converter -----------------------------------
const NAMED = {30:'#000',31:'#e06c75',32:'#98c379',33:'#e5c07b',34:'#61afef',35:'#c678dd',36:'#56b6c2',37:'#dcdcdc',
  90:'#7f848e',91:'#e06c75',92:'#98c379',93:'#e5c07b',94:'#61afef',95:'#c678dd',96:'#56b6c2',97:'#fff'};
const esc = (s)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function convert(text){
  let fg=null, bold=false, dim=false, out='', open=false;
  const span=()=>{ if(open) out+='</span>'; const st=[]; if(fg)st.push('color:'+fg); if(bold)st.push('font-weight:700');
    if(dim)st.push('opacity:.65'); out+='<span style="'+st.join(';')+'">'; open=true; };
  span();
  const re=/\x1b\[([0-9;]*)m/g; let last=0,m;
  const flush=(end)=>{ out+=esc(text.slice(last,end)); };
  while((m=re.exec(text))){ flush(m.index); last=re.lastIndex;
    const parts=m[1].split(';').map(Number); 
    for(let i=0;i<parts.length;i++){ const c=parts[i];
      if(c===0){fg=null;bold=false;dim=false;}
      else if(c===1)bold=true; else if(c===2)dim=true; else if(c===22){bold=false;dim=false;}
      else if(c===39)fg=null;
      else if(c===38&&parts[i+1]===2){fg=`rgb(${parts[i+2]},${parts[i+3]},${parts[i+4]})`;i+=4;}
      else if(c===38&&parts[i+1]===5){i+=2;/* skip 256 */}
      else if(NAMED[c])fg=NAMED[c];
    }
    span();
  }
  flush(text.length); if(open)out+='</span>';
  return out;
}

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  body{margin:0;background:#0d1117}
  .term{padding:24px 28px;background:#0d1117;color:#dcdcdc;
    font-family:'DejaVu Sans Mono','Cascadia Code',Menlo,monospace;font-size:15px;line-height:1.32;white-space:pre;
    display:inline-block}
</style></head><body><div class="term">${convert(ansi)}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
const el = await page.$('.term');
await el.screenshot({ path: new URL('./lostfast-cli.png', import.meta.url).pathname });
await browser.close();
console.log('screenshot written');
