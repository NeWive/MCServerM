const serverCmd = require('../serverCmd.config');
const Utils = require('./Util');
const colors = require('colors');
const childProcess = require('child_process');
const Status = require('./Status');

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
        return `${Math.floor(new Date().getTime()/1000)}.zip`;
    }

    /**
     * getBackupCmd
     */
    _generateBackupCmd(name) {
        return `7z a -t7z ${Utils.resolveAbsolutePath([global.backupDir, name])} @${Utils.resolveAbsolutePath(['backup_filelist.ini'])} -xr\!session.lock | grep size`;
    }

    /**
     * 
     */
    updateLogFile(name) {

    }

    backup() {
        try {
            let name = this._generateSlotName();
            let cmd = this._generateBackupCmd(name);
            this._print([cmd, 'Starting to backup......'], 'backup module');
            let archieveLog = childProcess.execSync(cmd);
            this._print([archieveLog], 'backup module');

            return { msg: archieveLog, status: Status.OK };
        } catch(e) {
            return { status: Status.FAILED, code: e.code, msg: e.message };
        }
    }

}

module.exports = CmdHandler;