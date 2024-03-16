import semver from 'semver';
// @ts-ignore
import { engines } from '../package';

const version: string = engines.node;
if (!semver.satisfies(process.version, version)) {
    console.error(`Required node version ${version} does not match current version ${process.version}`);
} else {
    console.log(`Process version ${process.version} satisfies required version ${version}!`);
}
