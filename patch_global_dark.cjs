const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

const newBase = `@layer base {
  body {
    @apply text-slate-900 bg-slate-50 antialiased transition-colors duration-300;
    font-family: 'Cairo', sans-serif;
  }
  
  .dark body {
    @apply text-slate-100 bg-slate-900;
  }

  /* Universal dark mode overrides for basic structural elements to save adding classes everywhere */
  .dark .bg-white {
    @apply bg-slate-800 border-slate-700 !important;
  }
  .dark .bg-slate-50 {
    @apply bg-slate-800/50 !important;
  }
  .dark .bg-slate-100 {
    @apply bg-slate-700 !important;
  }
  .dark .border-slate-100, .dark .border-slate-200 {
    @apply border-slate-700 !important;
  }
  .dark .text-slate-800, .dark .text-slate-900 {
    @apply text-white !important;
  }
  .dark .text-slate-700, .dark .text-slate-600 {
    @apply text-slate-300 !important;
  }
  .dark .text-slate-500 {
    @apply text-slate-400 !important;
  }
  .dark .shadow-sm, .dark .shadow-md {
    @apply shadow-black/20 !important;
  }
}`;

css = css.replace(/@layer base \{[\s\S]*?\}/, newBase);
fs.writeFileSync('src/index.css', css);
