#!/usr/bin/env node

import { Command } from 'commander';

export const pear = new Command();

import './commands/init';
import './commands/start';

pear
    .command('end')
    .description('End a pair programming session')

pear
    .command('add')
    .description('Remove a contributor from your Pear configuration')
    .argument('<contributor>', 'The name of the contributor you are adding')

pear
    .command('remove')
    .description('Remove a contributor from your Pear configuration')
    .argument('<contributor>', 'The name of the contributor you are removing')

pear
    .command('matrix')
    .description('Generate a pairing matrix based on your project\'s commit history')

pear.parse(process.argv);