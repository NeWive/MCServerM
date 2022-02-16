import fetch, {Response} from "node-fetch";
import globalConfig from "./Config";
import {DownloaderType} from "./interface";
import {mkdir, downloadAssets, writeFile} from "./FileHandler";
import path from "path";
import cheerio from "cheerio";

class Downloader {
    public _fabricGameList: Array<string>;
    public _fabricLoaderList: Array<string>;
    public _fabricInstallerList: Array<string>;
    public _fabricSelectedVersions!: DownloaderType.VersionAnswers;
    public _fabricAPIVersions!: DownloaderType.FabricAPIVersions;

    constructor() {
        this._fabricGameList = [];
        this._fabricLoaderList = [];
        this._fabricInstallerList = [];
        this._fabricSelectedVersions = {
            installer: "",
            game: "",
            loader: "",
            fabricAPI: ""
        }
    }

    private static async _resolveFabricResponse(data: Response) {
        const j = <[DownloaderType.ListResponseSel]>await data.json();
        return j.filter((i) => {
            return i.stable;
        }).map((i) => i.version);
    }

    private static async _defaultResponseResolver(data: Response) {
        return await data.json();
    }

    private _request(url: string, dataResolver: (data: Response) => any) {
        return new Promise((res, rej) => {
            setTimeout(() => {
                console.log(url);
                fetch(url).then(async (data) => {
                    res(await dataResolver(data));
                });
            });
        });
    }
    private static async _fabricAPIResponseResolver(data: Response) {
        const root = cheerio.load(await data.text());
        const listsHyperLinkDOM = root("a");
        let hyperLinkTitleList = listsHyperLinkDOM.text().split("/");
        hyperLinkTitleList.splice(0, 1);
        hyperLinkTitleList = hyperLinkTitleList.filter(i => !/(build|maven|experimental)/.test(i));
        const fabricAPIVersions = new Map<string, Array<string>>();
        for (let i of hyperLinkTitleList) {
            let temp = i.split("+");
            let MCVersion = temp[1];
            if (fabricAPIVersions.has(MCVersion)) {
                let prevList = <Array<string>>(fabricAPIVersions.get(MCVersion));
                prevList.push(temp[0]);
                fabricAPIVersions.set(MCVersion, prevList);
            } else {
                fabricAPIVersions.set(MCVersion, [temp[0]]);
            }
        }
        for (let i of fabricAPIVersions.keys()) {
            (<Array<string>>(fabricAPIVersions.get(i))).sort((a, b) => {
                let an = Number(a.replace(".", ""));
                let bn = Number(b.replace(".", ""));
                return bn - an;
            });
        }
        return fabricAPIVersions;
    }

    public async requestFabricInfo() {
        try {
            console.log("获取FabricGame信息...");
            this._fabricGameList = <Array<string>>await this._request(globalConfig.fabricGameURL, Downloader._resolveFabricResponse);
            console.log("获取FabricInstaller信息...");
            this._fabricInstallerList = <Array<string>>await this._request(globalConfig.fabricInstallerURL, Downloader._resolveFabricResponse);
            console.log("获取FabricLoader信息...");
            this._fabricLoaderList = <Array<string>>await this._request(globalConfig.fabricLoaderURL, Downloader._resolveFabricResponse);
            console.log("获取FabricAPI信息...");
            this._fabricAPIVersions =  <DownloaderType.FabricAPIVersions>await this._request(globalConfig.fabricAPISourceURL, Downloader._fabricAPIResponseResolver);
        } catch (e) {
            console.log(e);
            throw e;
        }
    }

    public async getFabricServer(serverName: string, gameVer: string, loaderVer: string, installerVer: string, apiVer: string) {
        let serverSavePath = path.resolve(globalConfig.dir.Versions, `${serverName}`);
        let url = `${globalConfig.fabricLoaderURL}/${gameVer}/${loaderVer}/${installerVer}/server/jar`;
        try {
            await mkdir(serverSavePath);
            await mkdir(path.resolve(serverSavePath, "mods"));
            await downloadAssets(url, path.join(serverSavePath, "server.jar"), globalConfig.headers[0]);
            // TODO: 是否保留默认下载FabricAPI
            const targetName = `fabric-api-${apiVer}.jar`;
            const apiURL = `${globalConfig.fabricAPISourceURL}/${apiVer}/${targetName}`;
            await downloadAssets(apiURL, path.join(serverSavePath, "mods/", targetName), globalConfig.headers[1]);
            console.log("默认写入EULA");
            await writeFile(path.join(serverSavePath, "eula.txt"), "eula=true");
        } catch (e) {
            throw e;
        }
    }
}

const downloader = new Downloader();

export default downloader;
