import solc from 'solc';
import path from 'path';
import {promisify} from 'util';
import fetch from 'node-fetch';
import {ImportFile} from '@resolver-engine/imports';
import {isDirectory} from './utils';
import {Config} from './config';
import {getCompilerInput} from './compilerInput';
import {findImports} from './findImports';

const loadRemoteVersion = promisify(solc.loadRemoteVersion);
const semverRegex = /^\d+\.\d+\.\d+$/;

export async function loadCompiler(config: Config) {
  if (config.compilerVersion !== 'default') {
    if (isDirectory(config.compilerVersion)) {
      return require(path.resolve(config.compilerVersion));
    } else if (semverRegex.test(config.compilerVersion)) {
      if (solc.version().startsWith(`${config.compilerVersion}+`)) {
        return solc;
      }
      try {
        const version = await resolveSemverVersion(config.compilerVersion);
        return loadRemoteVersion(version);
      } catch (e) {
        throw new Error(`Error fetching version: ${config.compilerVersion}.`);
      }
    }
    return loadRemoteVersion(config.compilerVersion);
  }
  return solc;
}

async function resolveSemverVersion(version: string) {
  const releases = await fetchReleases();
  const item: string = releases[version];
  return item.substring('soljson-'.length, item.length - '.js'.length);
}

const VERSION_LIST_URL = 'https://ethereum.github.io/solc-bin/bin/list.json';
let cache: any = undefined;
async function fetchReleases() {
  if (!cache) {
    const res = await fetch(VERSION_LIST_URL);
    const {releases} = await res.json();
    cache = releases;
  }
  return cache;
}

export function compileSolcjs(config: Config) {
  return async function compile(sources: ImportFile[]) {
    const solc = await loadCompiler(config);
    const input = getCompilerInput(sources, config.compilerOptions, 'Solidity');
    const imports = findImports(sources);
    const output = solc.compile(input, {imports});
    return JSON.parse(output);
  };
}
