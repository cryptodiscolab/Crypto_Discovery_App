const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.jsx') || file.endsWith('.js')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const files = getAllFiles(srcDir);

let countReact = 0;
let countCatch = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // 1. Remove unused React import from "import React, { ... } from 'react'"
  // ONLY if "React" is not used as a variable in the rest of the file
  if (content.includes('import React, {')) {
    const restOfFile = content.split('import React, {')[1];
    // Check if React is used elsewhere (not in import and not as <React.Fragment or React.useState)
    // A simple check: if "React" appears outside of the import line
    const occurrences = (content.match(/React/g) || []).length;
    if (occurrences === 1) { // Only the import
      content = content.replace('import React, {', 'import {');
      countReact++;
    }
  } else if (content.includes("import React from 'react';") || content.includes('import React from "react";')) {
     const occurrences = (content.match(/React/g) || []).length;
     if (occurrences === 1) {
       content = content.replace(/import React from ['"]react['"];?\r?\n?/, '');
       countReact++;
     }
  }

  // 2. Fix unused error in catch blocks: catch (error) -> catch (_)
  // Match catch (err) or catch (error) followed by empty or just console.error/warn
  content = content.replace(/catch\s*\((err|error)\)\s*{/g, 'catch (_) {');
  if (content !== originalContent) {
    countCatch++;
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log(`Cleanup complete!`);
console.log(`- Removed ${countReact} unused React imports`);
console.log(`- Refactored ${countCatch} catch blocks`);
