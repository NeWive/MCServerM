import globalConfig from "./Config";
import path from "path";
import {readFile} from "./FileHandler";
import archiver from "archiver";
import fs from "fs";

interface MapTempType {
    key: string;
    value: string;
}

class BackupManager {
    generateSlotName(serverName: string) {
        let time = new Date().getTime() / 1000;
        return {
            name: `${serverName}_${Math.floor(time)}.zip`,
            time: Math.floor(time)
        };
    }

    async getSlotsInfo(serverName: string) {
        try {
            let result = await readFile(path.resolve(globalConfig.projectDir, globalConfig.dir.BACKUP, `${serverName}.json`));
            return JSON.parse(result.toString());
        } catch (e) {
            console.log(e);
            console.log("获取SlotInfo失败");
        }
    }

    backup(serverName: string, tips: string) {
        return new Promise(async (res) => {
            try {
                let {name, time} = this.generateSlotName(serverName);
                const serverPath = path.resolve(globalConfig.projectDir, globalConfig.dir.Versions, serverName);
                let savePath = (<MapTempType>(await readFile(path.resolve(serverPath, "server.properties"))).toString().split('\n').map(i => {
                    let arr = i.split('=');
                    return {
                        key: arr[0],
                        value: arr[1]
                    }
                }).find(i => i.key === 'level-name')).key + "/";
                const output = fs.createWriteStream(path.resolve(globalConfig.projectDir, globalConfig.dir.BACKUP, `${name}.zip`));
                const archive = archiver("zip", {
                    comment: tips
                })
                output.on('close', function () {
                    console.log(archive.pointer() + " total bytes");
                    console.log("备份结束");
                });
                output.on('end', function () {
                    console.log('Data has been drained');
                });
                archive.on('error', function (err) {
                    throw err;
                });
                archive.on("progress", function (entries) {
                    console.log(entries.entries.processed + "/" + entries.entries.total);
                });
                archive.pipe(output);
                let fileList = globalConfig.backupConfig.backupFiles;
                archive.directory(path.resolve(serverPath, savePath), savePath);
                for (let i of fileList) {
                    archive.append(path.resolve(serverPath, i), { name: i });
                }
                await archive.finalize();
                res(1);
            } catch (e) {
                console.log(e);
            }
        });
    }
}
