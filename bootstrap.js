const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const scriptFilename = path.basename(__filename);

const directoryPath = process.cwd(); // Default to current working directory
const placeholder = 'typescript-template'; // Placeholder to replace

const defaultReplacement = path.basename(directoryPath); // Default replacement value

rl.question(`Enter the replacement value (default: ${defaultReplacement}): `, replacement => {
  replacement = replacement || defaultReplacement;

  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      rl.close();
      return;
    }

    files.forEach(file => {
      const filePath = path.join(directoryPath, file);

      if (file === scriptFilename) {
        return;
      }

      try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
          return;
        }
      } catch (error) {
        console.error('Error while running stats on file', filePath, error);
      }

      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', file, err);
          return;
        }

        const updatedContent = data.replace(new RegExp(placeholder, 'g'), replacement);

        fs.writeFile(filePath, updatedContent, 'utf8', err => {
          if (err) {
            console.error('Error writing file:', file, err);
          } else {
            console.log('Updated file:', file);
          }
        });
      });
    });
    rl.close();
  });
});
