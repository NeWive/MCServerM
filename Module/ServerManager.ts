import DBManager from "./DBManager";
import globalConfig from "./Config";
import {readFile} from "./FileHandler";
import path from "path";

interface MapTempType {
    key: string;
    value: string;
}

class ServerManager extends DBManager {
    constructor() {
        super();
    }
}

export default ServerManager;
