#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix error handling patterns
function fixErrorHandling(content) {
  // Fix error.message pattern
  content = content.replace(/error\.message/g, 'error instanceof Error ? error.message : "Unknown error"');
  // Fix error.stack pattern
  content = content.replace(/error\.stack/g, 'error instanceof Error ? error.stack : undefined');
  return content;
}

// Fix unused imports
function fixUnusedImports(content) {
  // Remove unused Request import if not used
  if (!content.includes('@Request()') && !content.includes('Request')) {
    content = content.replace(/,\s*Request,?/g, '');
    content = content.replace(/Request,\s*/g, '');
  }

  // Remove unused ApiBody import
  if (!content.includes('@ApiBody')) {
    content = content.replace(/,\s*ApiBody,?/g, '');
    content = content.replace(/ApiBody,\s*/g, '');
  }

  // Remove unused Delete import
  if (!content.includes('@Delete')) {
    content = content.replace(/,\s*Delete,?/g, '');
    content = content.replace(/Delete,\s*/g, '');
  }

  return content;
}

// Fix definite assignment assertions for DTOs
function fixDtoProperties(content) {
  // Add definite assignment assertions to class properties without initializers
  // This is a simplified pattern - might need refinement for specific cases
  content = content.replace(/^(\s*)([^:]+):\s*([^;{}]+);$/gm, '$1$2!: $3;');
  return content;
}

// Process TypeScript files
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    content = fixErrorHandling(content);
    content = fixUnusedImports(content);

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Find and process all TypeScript files
function findTsFiles(dir) {
  const files = [];

  function traverse(currentDir) {
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
  }

  traverse(dir);
  return files;
}

const srcDir = path.join(__dirname, 'src');
const tsFiles = findTsFiles(srcDir);

console.log(`Processing ${tsFiles.length} TypeScript files...`);

for (const file of tsFiles) {
  processFile(file);
}

console.log('TypeScript fixes completed!');