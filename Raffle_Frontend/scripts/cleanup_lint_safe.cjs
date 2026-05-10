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

  // 1. SAFE Remove unused React import
  if (content.includes('import React, {')) {
     const count = (content.match(/\bReact\b/g) || []).length;
     if (count === 1) {
       content = content.replace('import React, {', 'import {');
       countReact++;
     }
  } else if (content.includes("import React from 'react';") || content.includes('import React from "react";')) {
     const count = (content.match(/\bReact\b/g) || []).length;
     if (count === 1) {
       content = content.replace(/import React from ['"]react['"];?\r?\n?/, '');
       countReact++;
     }
  }

  // 2. SAFE Fix unused error in catch blocks
  // Regex to find catch(err) and its body
  const catchRegex = /catch\s*\((err|error)\)\s*{([\s\S]*?)}/g;
  content = content.replace(catchRegex, (match, varName, body) => {
    const isUsed = body.includes(varName);
    if (!isUsed) {
      countCatch++;
      return `catch (_) {${body}}`;
    }
    return match;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log(`Safe Cleanup complete!`);
console.log(`- Removed ${countReact} unused React imports`);
console.log(`- Refactored ${countCatch} truly unused catch blocks`);
