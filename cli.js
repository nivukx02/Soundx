#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { audioToPCM, pcmToAudio, getAudioMetadata, detectOutputFormat, isValidAudioFile } from './audioProcessor.js';
import { writeNIVFile } from './encoder.js';
import { decodeFromNIV, getNIVInfo } from './decoder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// CLI Configuration
program
  .name('niv')
  .description('CLI tool for encoding/decoding audio files to custom .NIV lossless format')
  .version('2.0.0');

/**
 * Encode command
 */
program
  .command('encode')
  .description('Encode audio file(s) to .NIV format')
  .argument('<input>', 'Input audio file or directory')
  .option('-o, --output <path>', 'Output file or directory')
  .option('-r, --recursive', 'Process directories recursively', false)
  .option('-q, --quality <level>', 'Compression quality (1-9, default: 9)', '9')
  .action(async (input, options) => {
    try {
      const inputPath = path.resolve(input);
      
      // Check if input exists
      if (!fs.existsSync(inputPath)) {
        console.error(chalk.red(`Error: Input path does not exist: ${inputPath}`));
        process.exit(1);
      }
      
      const stats = fs.statSync(inputPath);
      
      if (stats.isDirectory()) {
        await encodeDirectory(inputPath, options);
      } else {
        await encodeFile(inputPath, options);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Decode command
 */
program
  .command('decode')
  .description('Decode .NIV file(s) to audio format')
  .argument('<input>', 'Input .NIV file or directory')
  .option('-o, --output <path>', 'Output file or directory')
  .option('-f, --format <format>', 'Output format (wav, flac, mp3, aac, ogg)', 'flac')
  .option('-r, --recursive', 'Process directories recursively', false)
  .action(async (input, options) => {
    try {
      const inputPath = path.resolve(input);
      
      if (!fs.existsSync(inputPath)) {
        console.error(chalk.red(`Error: Input path does not exist: ${inputPath}`));
        process.exit(1);
      }
      
      const stats = fs.statSync(inputPath);
      
      if (stats.isDirectory()) {
        await decodeDirectory(inputPath, options);
      } else {
        await decodeFile(inputPath, options);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Info command
 */
program
  .command('info')
  .description('Display information about .NIV file')
  .argument('<input>', 'Input .NIV file')
  .action(async (input) => {
    try {
      const inputPath = path.resolve(input);
      
      if (!fs.existsSync(inputPath)) {
        console.error(chalk.red(`Error: File does not exist: ${inputPath}`));
        process.exit(1);
      }
      
      const spinner = ora('Reading .NIV file...').start();
      const info = await getNIVInfo(inputPath);
      spinner.succeed('File information retrieved');
      
      console.log(chalk.cyan('\n.NIV File Information:'));
      console.log(chalk.white('━'.repeat(50)));
      console.log(chalk.yellow('Version:'), info.version);
      console.log(chalk.yellow('Channels:'), info.channels);
      console.log(chalk.yellow('Sample Rate:'), `${info.sampleRate} Hz`);
      console.log(chalk.yellow('Bit Depth:'), `${info.bitDepth} bits`);
      console.log(chalk.yellow('Compressed Size:'), formatBytes(info.audioDataSize));
      
      if (info.metadata) {
        console.log(chalk.cyan('\nMetadata:'));
        console.log(chalk.white('━'.repeat(50)));
        Object.entries(info.metadata).forEach(([key, value]) => {
          console.log(chalk.yellow(`${key}:`), value);
        });
      }
      console.log();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Encode a single file
 */
async function encodeFile(inputPath, options) {
  const spinner = ora(`Encoding ${path.basename(inputPath)}...`).start();
  
  try {
    // Validate audio file
    if (!await isValidAudioFile(inputPath)) {
      spinner.fail(chalk.red('Invalid audio file format'));
      return;
    }
    
    // Determine output path
    const outputPath = options.output 
      ? path.resolve(options.output)
      : inputPath.replace(path.extname(inputPath), '.niv');
    
    spinner.text = 'Converting to PCM...';
    const { audioInfo, pcmData, metadata } = await audioToPCM(inputPath);
    
    spinner.text = 'Encoding to .NIV format...';
    const stats = await writeNIVFile(outputPath, audioInfo, pcmData, metadata);
    
    spinner.succeed(chalk.green(`Encoded successfully!`));
    console.log(chalk.cyan('Output:'), outputPath);
    console.log(chalk.cyan('Original Size:'), formatBytes(stats.originalSize));
    console.log(chalk.cyan('Encoded Size:'), formatBytes(stats.encodedSize));
    console.log(chalk.cyan('Compression Ratio:'), `${stats.compressionRatio}:1`);
    console.log();
  } catch (error) {
    spinner.fail(chalk.red(`Failed: ${error.message}`));
    throw error;
  }
}

/**
 * Encode directory
 */
async function encodeDirectory(inputPath, options) {
  const files = await findAudioFiles(inputPath, options.recursive);
  
  if (files.length === 0) {
    console.log(chalk.yellow('No audio files found in directory'));
    return;
  }
  
  console.log(chalk.cyan(`Found ${files.length} audio file(s)\n`));
  
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} files',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(files.length, 0);
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const outputDir = options.output ? path.resolve(options.output) : path.dirname(file);
    const outputPath = path.join(outputDir, path.basename(file).replace(path.extname(file), '.niv'));
    
    try {
      const { audioInfo, pcmData, metadata } = await audioToPCM(file);
      await writeNIVFile(outputPath, audioInfo, pcmData, metadata);
      progressBar.increment();
    } catch (error) {
      progressBar.stop();
      console.error(chalk.red(`\nFailed to encode ${path.basename(file)}: ${error.message}`));
      progressBar.start(files.length, i + 1);
    }
  }
  
  progressBar.stop();
  console.log(chalk.green(`\n✓ Encoded ${files.length} file(s) successfully!\n`));
}

/**
 * Decode a single file
 */
async function decodeFile(inputPath, options) {
  const spinner = ora(`Decoding ${path.basename(inputPath)}...`).start();
  
  try {
    // Determine output path
    let outputPath;
    if (options.output) {
      outputPath = path.resolve(options.output);
    } else {
      const baseName = path.basename(inputPath, '.niv');
      outputPath = path.join(path.dirname(inputPath), `${baseName}.${options.format}`);
    }
    
    spinner.text = 'Decoding .NIV file...';
    const { audioInfo, pcmData, metadata } = await decodeFromNIV(inputPath);
    
    spinner.text = 'Converting to audio format...';
    await pcmToAudio(pcmData, audioInfo, outputPath, options.format);
    
    spinner.succeed(chalk.green(`Decoded successfully!`));
    console.log(chalk.cyan('Output:'), outputPath);
    console.log(chalk.cyan('Format:'), options.format.toUpperCase());
    console.log(chalk.cyan('Channels:'), audioInfo.channels);
    console.log(chalk.cyan('Sample Rate:'), `${audioInfo.sampleRate} Hz`);
    console.log();
  } catch (error) {
    spinner.fail(chalk.red(`Failed: ${error.message}`));
    throw error;
  }
}

/**
 * Decode directory
 */
async function decodeDirectory(inputPath, options) {
  const files = await findNIVFiles(inputPath, options.recursive);
  
  if (files.length === 0) {
    console.log(chalk.yellow('No .NIV files found in directory'));
    return;
  }
  
  console.log(chalk.cyan(`Found ${files.length} .NIV file(s)\n`));
  
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} files',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(files.length, 0);
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const outputDir = options.output ? path.resolve(options.output) : path.dirname(file);
    const baseName = path.basename(file, '.niv');
    const outputPath = path.join(outputDir, `${baseName}.${options.format}`);
    
    try {
      const { audioInfo, pcmData } = await decodeFromNIV(file);
      await pcmToAudio(pcmData, audioInfo, outputPath, options.format);
      progressBar.increment();
    } catch (error) {
      progressBar.stop();
      console.error(chalk.red(`\nFailed to decode ${path.basename(file)}: ${error.message}`));
      progressBar.start(files.length, i + 1);
    }
  }
  
  progressBar.stop();
  console.log(chalk.green(`\n✓ Decoded ${files.length} file(s) successfully!\n`));
}

/**
 * Find audio files in directory
 */
async function findAudioFiles(dir, recursive) {
  const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.alac', '.opus'];
  const files = [];
  
  async function scan(directory) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory() && recursive) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (audioExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  await scan(dir);
  return files;
}

/**
 * Find .NIV files in directory
 */
async function findNIVFiles(dir, recursive) {
  const files = [];
  
  async function scan(directory) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory() && recursive) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.niv')) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(dir);
  return files;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Parse and execute
program.parse();
