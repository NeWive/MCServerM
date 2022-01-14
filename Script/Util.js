const fs = require('fs');
const Status = require("./Status");
const path = require("path");
const crypto = require("crypto");

/**
 *
 * @param path: absolute path
 * @returns {Promise<Object>}
 */
function readDirectory(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if(err) {
                reject({ status: Status.FAILED, code: err.code, message: err.message });
            } else {
                resolve({ status: Status.OK, data: files});
            }
        });
    })
}

/**
 * @param msgArr: Array type
 */
function outputLog(msgArr = []) {
    for (let item of msgArr) {
        console.log(item);
    }
}

/**
 * 拼接绝对路径
 * @param pathArr: Array
 * @returns {string}
 */
function resolveAbsolutePath(pathArr) {
    return path.resolve(global.projectDir, ...pathArr);
}

/**
 *
 * @param path
 * @returns {Promise<Object>}
 */
function getFile(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if(err) {
                reject({ status: Status.FAILED, code: err.code, message: err.message });
            } else {
                resolve({ status: Status.OK, data});
            }
        });
    });
}

/**
 *
 * @param data: file data
 * @returns {string}
 */
function getFileMD5(data) {
    let fsHash = crypto.createHash('md5');
    fsHash.update(data);
    return fsHash.digest('hex');
}

/**
 * path: absolute path
 * @param {*} data
 */
function writeFile(data, path) {
    return new Promise((res, rej) => {
        fs.writeFile(path, data, () => {
            res();
        });
    });
}

module.exports = {
    outputLog,
    readDirectory,
    resolveAbsolutePath,
    getFile,
    getFileMD5,
    writeFile
}
