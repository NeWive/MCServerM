const Utils = require('./Util');
const colors = require('colors');
const childProcess = require('child_process');
const Status = require('./Status');
const util = require('util');


class CmdHandler {
    /**
     * 
     * @param {*} savePath
     * @param {*} backupPath 
     * @param {*} slotNumber 
     */
    constructor(slotNumber) {
        this.slotNumber = slotNumber;
    }

    _print(msgArr, source) {
        msgArr.forEach(msg => {
            Utils.outputLog([colors.green(`[${source}]: `) + msg]);
        });
    }

    /**
     * save name
     */
    _generateSlotName() {
        let time = new Date().getTime() / 1000;
        return { name: `${Math.floor(time)}.zip`, time: Math.floor(time) };
    }

    /**
     * getBackupCmd
     */
    _generateBackupCmd(name) {
        return `7z a -t7z ${Utils.resolveAbsolutePath([global.backupDir, name])} @${Utils.resolveAbsolutePath(['backup_filelist.ini'])} -xr\!session.lock | grep size`;
    }

    /**
     * slot_list entry
     */
    async getSlotsInfo() {
        let result = await Utils.getFile(Utils.resolveAbsolutePath([global.backupDir, 'slots.json']));
        if (result.status === Status.OK) {
            try {
                let logs = JSON.parse(result.data);
                return { status: Status.OK, data: logs };
            } catch (e) {
                this._print([colors.red('JSON parse error')], 'rollback module');
                return { status: Status.FAILED, code: -114515, msg: 'JSON parse error' };
            }
        }
    }

    /**
     * roll back entry
     */
    async rollback(slotIndex) {
        if (slotIndex >= 0 && slotIndex < this.slotNumber) {
            let result = await Utils.getFile(Utils.resolveAbsolutePath([global.backupDir, 'slots.json']));
            if (result.status === Status.OK) {
                try {
                    let logs = JSON.parse(result.data.toString());
                    if (slotIndex < logs.length) {
                        await new Promise((closeRes) => {
                            global.listener.once('server-close', () => {
                                this._print(['server closed ...'], 'EventDispatcher');
                                closeRes();
                            });
                            global.server.executeCmd('/stop');
                        });
                        let fileInfo = logs[slotIndex];
                        let rmCmd = `rm ${Utils.resolveAbsolutePath(['world/'])} -rf`;
                        this._print([rmCmd, 'deleting pre saves...'], 'rollback module');
                        await util.promisify(childProcess.exec)(rmCmd);
                        let cmd = `7z x ${Utils.resolveAbsolutePath([global.backupDir, fileInfo.name])} -o${global.projectDir} -y`;
                        this._print([cmd, 'extracting backup saves...'], 'rollback module');
                        await util.promisify(childProcess.exec)(cmd);
                        this._print(['extract saves complete'], 'rollback module');
                        return { status: Status.OK };
                    } else {
                        this._print([colors.red('error slot index')], 'rollback module');
                        return { status: Status.FAILED, code: -114514, msg: 'error slot index' };
                    }
                } catch (e) {
                    console.log(e);
                    this._print([colors.red('JSON parse error')], 'rollback module');
                    return { status: Status.FAILED, code: -114515, msg: 'JSON parse error' };
                }
            }
        } else {
            this._print([colors.red('error slot index')], 'rollback module');
            return { status: Status.FAILED, code: -114514, msg: 'error slot index' };
        }
    }

    /**
     * backup entry
     * @param {*} uid 
     */
    async backup(tips, uid) {
        try {
            let obj = this._generateSlotName();
            let cmd = this._generateBackupCmd(obj.name);
            this._print([cmd, 'Starting to backup......'], 'backup module');
            let archieveLog = await util.promisify(childProcess.exec)(cmd);
            this._print([archieveLog], 'backup module');
            this._print(['reading slots log files...'], 'backup module');
            let result = await Utils.getFile(Utils.resolveAbsolutePath([global.backupDir, 'slots.json']));
            if (result.status === Status.OK) {
                try {
                    let logs = JSON.parse(result.data);
                    logs.push({ name: obj.name, time: obj.time, executer: uid, tips });
                    if (logs.length > this.slotNumber) {
                        let expired = logs[0].name;
                        logs.splice(0, 1).name;
                        let cmd = `rm ${Utils.resolveAbsolutePath([global.backupDir, expired])}`;
                        this._print([cmd], 'backup module');
                        await util.promisify(childProcess.exec)(cmd);
                    }
                    await Utils.writeFile(JSON.stringify(logs), Utils.resolveAbsolutePath([global.backupDir, 'slots.json']));
                    this._print(['write slots log file complete', 'backup complete!'], 'backup module');
                    return { msg: archieveLog, status: Status.OK };
                } catch (e) {
                    this._print([e.message], 'backup module');
                    this._print([colors.red('JSON parse error')], 'backup module');
                    return { status: Status.FAILED, code: -114515, msg: 'JSON parse error' };
                }
            } else {
                return { status: Status.FAILED, code: result.code, msg: result.message }
            }
        } catch (e) {
            return { status: Status.FAILED, code: e.code, msg: e.message };
        }
    }
}

module.exports = CmdHandler;
