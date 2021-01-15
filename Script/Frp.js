const Utils = require('./Util');
const Status = require("./Status");
const colors = require("colors");
const childProcess = require("child_process");
const _ = require('lodash');

class Frp {
    /**
     *
     * @param frpConfigDir: absolute path
     * @param frpClientDir: absolute path
     * @param frpClientTarget
     */
    constructor(frpConfigDir, frpClientDir, frpClientTarget) {
        this.frpConfigDir = frpConfigDir;
        this.frpClientDir = frpClientDir;
        this.frpClientTarget = frpClientTarget;
        this.frpList = [];
        this.hashList = [];
        this.isUpdatingFrp = false;
        this.execCmd = `${this.frpClientDir}/${this.frpClientTarget}`;
    }

    print(msgArr, source) {
        msgArr.forEach(msg => {
            Utils.outputLog([colors.green(`[${source}]: `) + msg]);
        });
    }

    async check() {
        let result = await Utils.readDirectory(this.frpClientDir);
        if (result.status === Status.FAILED) {
            this.print([colors.red(result.message)]);
            return false;
        } else if (result.status === Status.OK) {
            if (result.data.indexOf(this.frpClientTarget) > -1) {
                return true;
            } else {
                this.print([colors.red('缺少目标frp文件')]);
                return false;
            }
        }
    }

    async getConfigList() {
        let result = await Utils.readDirectory(this.frpConfigDir);
        if (result.status === Status.FAILED) {
            this.print([colors.red(result.message)]);
            return [];
        } else if (result.status === Status.OK) {
            let configs = result.data;
            return configs.filter((config) => {
                return /.ini$/.test(config);
            });
        }
    }

    async calculateMD5(start, target, md5Target, list) {
        if (start < list.length) {
            let absolutePath = Utils.resolveAbsolutePath([this.frpConfigDir, list[start]])
            let fileData = await Utils.getFile(absolutePath);
            let md5 = Utils.getFileMD5(fileData.data);
            target.push({
                md5,
                path: absolutePath,
                name: list[start].replace(/.ini/, ''),
                toggleStart: false,
                expired: false
            });
            md5Target.push(md5);
            await this.calculateMD5(++start, target, md5Target, list);
        }
    }

    /**
     * 递归开启frp
     * @returns {Promise<void>}
     */
    async frpStart(start) {
        if(start < this.frpList.length) {
            await new Promise((resolve) => {
                this.frpList[start].process = childProcess.spawn(this.execCmd, ['-c', this.frpList[start].path]);
                this.print(['pid: ' + this.frpList[start].process.pid], this.frpList[start].name);
                this.frpList[start].process.stdout.on('data', (data) => {
                    this.print([`stdout: ${data}`], this.frpList[start].name);
                    if(!this.frpList[start].toggleStart) {
                        this.frpList[start].toggleStart = true;
                        resolve();
                    }
                });
                this.frpList[start].process.stdout.on('error', (data) => {
                    this.print([`stdout: ${data}`], this.frpList[start].name);
                });
            });
            await this.frpStart(start + 1);
        }
    }

    /**
     * 读取更新过后的frp配置目录
     * @returns {Promise<void>}
     */
    async updateFrpInfo() {
        let newList = await this.getConfigList();
        let target = [];
        let md5Target = [];
        await this.calculateMD5(0, target, md5Target, newList);
        let flag = new Array(this.frpList.length).fill(false);
        // 添加新增的frp配置
        _(md5Target).forEach((md5, key) => {
            let index = _.findIndex(this.hashList, (i) => i === md5) > -1;
            if(index > -1) {
                flag[index] = true;
            } else {
                this.frpList.push(target[key]);
            }
        });
        // 删除已经过期的frp配置
        _(flag).forEach((v, key) => {
             if(!v) {
                 this.frpList[key].expired = true;
             }
        });
    }

    /**
     * 递归更新frp进程状态
     * @param start
     */
    async updateFrpProcess(start) {
        if(start < this.frpList.length) {
            await new Promise((resolve) => {
                let target = this.frpList[start];
                if(target.expired) {
                    // TODO: 待验证是否存在问题
                    childProcess.spawnSync('kill', [`${target.pid}`]);
                    this.frpList.splice(start, 1);
                }
            });
            await this.updateFrpProcess(start + 1);
        }
    }

    async updateFrp() {
        if(!this.isUpdatingFrp) {
            this.isUpdatingFrp = true;
            await this.updateFrpInfo();
            await this.updateFrpProcess(0);
            this.isUpdatingFrp = false;
        }
    }

    /**
     * 开启Frp 入口
     * @returns {Promise<boolean>}
     */
    async start() {
        let result = await this.check();
        if (result) {
            this.frpList = await this.getConfigList();
            let target = [];
            let md5Target = [];
            await this.calculateMD5(0, target, md5Target, this.frpList);
            this.frpList = target;
            this.hashList = md5Target;
            if (this.frpList.length > 0) {
                await this.frpStart(0);
                return true;
            }
        } else {
            return false;
        }
    }
}

module.exports = Frp;
