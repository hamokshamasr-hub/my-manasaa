const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

const oldPrint = `@media print {
  body * {
    visibility: hidden;
  }
  #printable-student-card, #printable-student-card * {
    visibility: visible;
  }
  #printable-student-card {
    position: absolute;
    left: 0;
    top: 0;
    /* Adjust width/height as needed for cm, e.g. 8.5cm x 5.5cm standard CR80 card */
    width: 8.5cm;
    height: 5.5cm;
    margin: 0;
    padding: 0;
    box-shadow: none !important;
    border: none !important;
  }
  /* Hide UI buttons inside the card during print */
  #printable-student-card button {
    display: none !important;
  }
}`;

const newPrint = `@media print {
  @page { margin: 0; }
  body { 
    margin: 0; 
    padding: 0;
    -webkit-print-color-adjust: exact; 
    print-color-adjust: exact;
    background: white;
  }
  body * {
    visibility: hidden;
  }
  #printable-student-card, #printable-student-card * {
    visibility: visible;
  }
  #printable-student-card {
    position: absolute;
    left: 0;
    top: 0;
    width: 8.5cm;
    height: 5.5cm;
    margin: 0;
    padding: 12px;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
  }
  #printable-student-card button {
    display: none !important;
  }
}`;

if (css.includes('@media print')) {
  css = css.replace(oldPrint, newPrint);
  fs.writeFileSync('src/index.css', css);
}
