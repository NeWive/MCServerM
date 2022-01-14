import globalConfig from "./Config";
import path from "path";
import {checkExists, readFile, writeFile, removeFile, readdir, isDir} from "./FileHandler";
import archiver from "archiver";
import fs from "fs";
import unzip from "extract-zip";

/**
 * 遇到困难摆大烂
 */

interface BackupLogType {
    serverName: string;
    tips: string;
    executor: string;
    archiveName: string;
    time: number;
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

    compress(serverName: string, tips: string, executor: string): Promise<void> {
        return new Promise(async (res) => {
            try {
                let {name, time} = this.generateSlotName(serverName);
                const output = fs.createWriteStream(path.resolve(globalConfig.projectDir, globalConfig.dir.BACKUP, `${name}`));
                const archive = archiver("zip", {
                    comment: tips,
                    zlib: { level: 9 },
                    store: true
                })
                output.on('close', function () {
                    console.log(archive.pointer() + " total bytes");
                    console.log("备份结束");
                    res();
                });
                output.on('end', function () {
                    console.log('Data has been drained');
                });
                archive.on('error', function (err) {
                    console.log(err);
                });
                archive.on("progress", function (entries) {
                    console.log(entries.fs.processedBytes + " Bytes");
                });
                archive.on("warning", (err) => {
                    console.log(err);
                });
                archive.pipe(output);
                let fileList = globalConfig.backupConfig.backupFiles;
                let dir = path.resolve(globalConfig.dir.Versions, serverName, globalConfig.serverConfig.saveDir);
                const serverPath = path.resolve(globalConfig.projectDir, globalConfig.dir.Versions, serverName);
                console.log(dir);

                // 区块等文件
                let blockFileList = await readdir(dir);
                blockFileList = blockFileList.filter((i) => !/session/.test(i));
                let result = await Promise.all(blockFileList.map((i) => isDir(path.resolve(dir, i))));
                blockFileList.forEach((f, i) => {
                    let target = path.resolve(dir, f);
                    console.log(target, path.resolve(globalConfig.serverConfig.saveDir, f))
                    if (result[i]) {
                        archive.directory(target, globalConfig.serverConfig.saveDir + "/" + f);
                    } else {
                        archive.append(target, {
                            name: globalConfig.serverConfig.saveDir + "/" + f
                        });
                    }
                });

                // 零碎的文件
                for (let i of fileList) {
                    console.log(path.resolve(serverPath, i));
                    archive.append(fs.createReadStream(path.resolve(serverPath, i)), {
                        name: i
                    });
                }
                archive.finalize().then(async () => {
                    let expired = await this.handleLogFile(serverName, tips, executor, name, time);
                    if (expired.length > 0) {
                        await removeFile(path.resolve(globalConfig.projectDir, globalConfig.dir.BACKUP, expired[0].archiveName));
                    }
                });
            } catch (e) {
                console.log(e);
            }
        });
    }

    async handleLogFile(serverName: string, tips: string, executor: string, archiveName: string, time: number): Promise<Array<BackupLogType>> {
        let logPath = path.resolve(globalConfig.projectDir, globalConfig.dir.BACKUP, `${serverName}.json`);
        let nLog = {
            serverName,
            tips,
            executor,
            archiveName,
            time
        }
        try {
            await checkExists(logPath);
            let data = <Array<BackupLogType>>JSON.parse((await readFile(logPath)).toString());
            data.push(nLog);
            if (data.length > globalConfig.backupConfig.slotNumber) {
                data.sort((a, b) => (a.time - b.time));
                let expired = data.splice(0, 1);
                await writeFile(logPath, JSON.stringify(data));
                return expired;
            } else {
                await writeFile(logPath, JSON.stringify(data));
                return [];
            }
        } catch (e) {
            console.log((<Error>e).message);
            await writeFile(logPath, JSON.stringify([nLog]));
            return [];
        }
    }

    async decompress(serverName: string, zipDir: string) {
        try {
            const dir = path.resolve(globalConfig.projectDir, globalConfig.dir.Versions, serverName);
            await unzip(zipDir, {
                dir: dir
            });
        } catch (e) {
            console.log(e);
        }
    }
}

const backupManager = new BackupManager();

export default backupManager;
