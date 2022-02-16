import fs from "fs";
import util from "util";
import axios, {AxiosRequestHeaders} from "axios";

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

export function readdir(path: string) {
    return util.promisify(fs.readdir)(path);
}

export function isDir(path: string): Promise<boolean> {
    return new Promise((res) => {
        fs.stat(path, (err, stat) => {
            res(stat.isDirectory());
        });
    });
}

export function downloadAssets(url: string, savePath: string, headers: AxiosRequestHeaders) {
    return new Promise(async (res, rej) => {
        try {
            const response = await axios.get(url, {
                responseType: "stream",
                headers,
                timeout: 20000
            });
            try {
                const writer = fs.createWriteStream(savePath);
                writer.on("finish", () => {
                    writer.close();
                    res(true);
                });
                writer.on("error", (err) => {
                    console.error("写入过程出现错误");
                    rej(err);
                });
                response.data.pipe(writer);
            } catch (e) {
                console.error("写入初始化错误");
                rej(e);
            }
        } catch (e) {
            console.error("请求错误");
            rej(e);
        }
    });
}
