#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix class properties without initializers
function fixClassProperties(content) {
  // Pattern to match class properties without definite assignment assertions
  // This handles common patterns in DTOs and services
  const lines = content.split('\n');
  const fixedLines = [];
  let inClass = false;
  let inInterface = false;
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Track if we're in a class or interface
    if (line.includes('class ') && !line.includes('//')) {
      inClass = true;
      inInterface = false;
    } else if (line.includes('interface ') && !line.includes('//')) {
      inInterface = true;
      inClass = false;
    } else if (line.includes('}') && (inClass || inInterface)) {
      // Check if this is the closing brace for our class/interface
      const currentIndent = line.match(/^\s*/)[0].length;
      if (currentIndent <= indentLevel) {
        inClass = false;
        inInterface = false;
      }
    }

    // Skip interface properties (they don't need initializers)
    if (inInterface) {
      fixedLines.push(line);
      continue;
    }

    // Fix class properties that lack definite assignment assertions
    // Pattern: property: type;
    if (inClass && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
      // Match property declarations without initializers or definite assignment assertions
      const propertyMatch = line.match(/^(\s*)([^:]+):\s*([^;=]+);(\s*)$/);
      if (propertyMatch && !line.includes('!') && !line.includes('=') && !line.includes('function') && !line.includes('constructor')) {
        const [, indent, propertyName, propertyType, trailingSpace] = propertyMatch;

        // Skip certain properties that should be optional
        if (!propertyName.includes('?') && !propertyType.includes('undefined')) {
          // Add definite assignment assertion
          line = `${indent}${propertyName}!: ${propertyType};${trailingSpace}`;
        }
      }
    }

    fixedLines.push(line);
  }

  return fixedLines.join('\n');
}

// Process TypeScript files
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    content = fixClassProperties(content);

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed properties in: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
  return false;
}

// Find and process all TypeScript files
function findTsFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          traverse(fullPath);
        } else if (stat.isFile() && item.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  traverse(dir);
  return files;
}

const srcDir = path.join(__dirname, 'src');
const tsFiles = findTsFiles(srcDir);

console.log(`Processing ${tsFiles.length} TypeScript files for property initialization fixes...`);

let fixedCount = 0;
for (const file of tsFiles) {
  if (processFile(file)) {
    fixedCount++;
  }
}

console.log(`Property initialization fixes completed! Fixed ${fixedCount} files.`);