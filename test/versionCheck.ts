import semver from 'semver';
// @ts-ignore
import { engines } from '../package';
import { exit } from 'process';

const version: string = engines.node;
if (!semver.satisfies(process.version, version)) {
    console.error(`Required node version ${version} does not match current version ${process.version}`);
    exit(1);
} else {
    console.log(`Process version ${process.version} satisfies required version ${version}!`);
}
