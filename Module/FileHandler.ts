import fs from "fs";
import util from "util";

export function readFile(path: string, option: Object = {}) {
    return util.promisify(fs.readFile)(path, option);
}

export function writeFile(path: string, data: string, option: Object = {}) {
    return util.promisify(fs.writeFile)(path, data, option);
}

export function checkExists(path: string) {
    return util.promisify(fs.access)(path, fs.constants.F_OK | fs.constants.W_OK);
}

export function mkdir(path: string) {
    return util.promisify(fs.mkdir)(path);
}

export function removeFile(path: string) {
    return util.promisify(fs.rm)(path);
}

export function removeDir(path: string, recursive: boolean = false) {
    return util.promisify(fs.rmdir)(path, {
        recursive
    });
}
