const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src', 'screens');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix single quotes like: 'COLORS.primary' -> COLORS.primary
  content = content.replace(/'COLORS\.([a-zA-Z]+)'/g, 'COLORS.$1');
  
  // Fix double quotes inside props like: color="COLORS.primary" -> color={COLORS.primary}
  content = content.replace(/([a-zA-Z]+)="COLORS\.([a-zA-Z]+)"/g, '$1={COLORS.$2}');
  
  // Just in case it was used as a generic string literal in JSX like: "COLORS.error"
  content = content.replace(/"COLORS\.([a-zA-Z]+)"/g, 'COLORS.$1');

  fs.writeFileSync(filePath, content, 'utf8');
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.tsx')) {
    processFile(path.join(screensDir, file));
  }
});
console.log("Fixed colors inside quotes");
