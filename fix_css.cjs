const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

css = css.replace(/!important/g, "");
// Replace standard classes with the ! modifier to make them important
css = css.replace(/@apply bg-slate-800 border-slate-700 ;/g, "@apply bg-slate-800! border-slate-700!;");
css = css.replace(/@apply bg-slate-800\/50 ;/g, "@apply bg-slate-800/50!;");
css = css.replace(/@apply bg-slate-700 ;/g, "@apply bg-slate-700!;");
css = css.replace(/@apply border-slate-700 ;/g, "@apply border-slate-700!;");
css = css.replace(/@apply text-white ;/g, "@apply text-white!;");
css = css.replace(/@apply text-slate-300 ;/g, "@apply text-slate-300!;");
css = css.replace(/@apply text-slate-400 ;/g, "@apply text-slate-400!;");
css = css.replace(/@apply shadow-black\/20 ;/g, "@apply shadow-black/20!;");

fs.writeFileSync('src/index.css', css);
