const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src', 'screens');

const themeColors = {
  primary: '#22C55E',
  primaryDark: '#15803D',
  lightGreen: '#DCFCE7',
  veryLightGreen: '#F0FDF4',
  softGreen: '#E8F7ED',
  background: '#F8FAF9',
  surface: '#FFFFFF',
  textPrimary: '#17201A',
  textSecondary: '#66736B',
  border: '#E3EAE5',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace local COLORS object block
  const colorBlockRegex = /const COLORS = \{[^}]*\};\n?/g;
  if (colorBlockRegex.test(content)) {
    content = content.replace(colorBlockRegex, '');
    
    // Add import if not present
    if (!content.includes("import { COLORS }")) {
      // Find the last import
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfImport = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfImport + 1) + "import { COLORS } from '../constants/theme';\n" + content.slice(endOfImport + 1);
      }
    }
  }

  // Replace hardcoded hex values
  content = content.replace(/#FF6A00/gi, "COLORS.primary");
  content = content.replace(/#FF8A1F/gi, "COLORS.primaryDark");
  content = content.replace(/#FFEDD5/gi, "COLORS.softGreen"); // Old orange-light background
  content = content.replace(/#FEF9C3/gi, "COLORS.lightGreen"); // Old yellow light
  content = content.replace(/#CA8A04/gi, "COLORS.primary");
  content = content.replace(/#FFFBEB/gi, "COLORS.veryLightGreen"); // Orange tinted bg
  content = content.replace(/#F59E0B/gi, "COLORS.warning");
  content = content.replace(/#EF4444/gi, "COLORS.error");

  fs.writeFileSync(filePath, content, 'utf8');
}

fs.readdirSync(screensDir).forEach(file => {
  if (file.endsWith('.tsx')) {
    processFile(path.join(screensDir, file));
  }
});

// Fix Bottom Tabs if they have hardcoded colors
const navFile = path.join(__dirname, 'src', 'navigation', 'AppNavigator.tsx');
if (fs.existsSync(navFile)) {
  let navContent = fs.readFileSync(navFile, 'utf8');
  navContent = navContent.replace(/#FF6A00/gi, "'#22C55E'");
  fs.writeFileSync(navFile, navContent, 'utf8');
}

console.log("Mobile Theme Replacement Done");
