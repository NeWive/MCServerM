export namespace DownloaderType {
    export type FabricAPIVersions = Map<string, Array<string>>;

    export interface ListResponseSel extends ListSel{
        stable: boolean;
    }

    export interface ListSel {
        version: string;
    }

    export interface VersionAnswers {
        game: string;
        loader: string;
        installer: string;
        fabricAPI: string;
    }
}

export namespace ConfigType {
    export interface dir extends Object{
        Versions: string;
        Cache: string;
        DB: string;
        BACKUP: string;
    }

    export interface ConfigRead {
        [i: string]: any;
    }

    export interface ServerConfig {
        [i: string]: any;
    }

    export interface BackupConfig {
        slotNumber: number;
        backupFiles: Array<string>
    }
}

export namespace PatternType {
    export interface PatternMap {
        [i: string]: RegExp;
    }

    export enum PatternAttr {
        TEST_RUN_SUCCESS = "TEST_RUN_SUCCESS",
        SERVER_START_DONE = "SERVER_START_DONE",
        SERVER_EXIT = "SERVER_EXIT"
    }
}

export namespace DBHandlerType {
    export interface DBColumn {
        cName: string;
        cDataType: string;
        attributes: Array<string>;
    }

    export interface DBTable {
        tName: string;
        columns: Array<DBColumn>;
    }

    export interface DBConfig {
        DBTarget: string;
        tables: Array<DBTable>;
    }

    export interface UpdatePairType {
        k: string;
        v: any;
    }

    export interface TableInfo {
        name: string;
    }
}

export namespace MCServerType {
    export enum Commands {
        SAY = "/say",
        SAVE_OFF = "/save-off",
        SAVE_ALL = "/save-all",
        SAVE_ON = "/save-on",
        STOP = "/stop"
    }
}

export namespace MCServerManagerType {
    export interface CmdType {
        cmd: string;
        args: Array<string>;
        from: string;
    }

    export interface CmdDispatcher {
        [i: string]: (args: CmdType) => void;
    }

    export interface Satellite {
        [i: string]: string;
    }
}

export namespace BackupManagerType {
    export interface BackupLogType {
        serverName: string;
        tips: string;
        executor: string;
        archiveName: string;
        time: number;
    }
}

export namespace CmdHandlerType {
    export enum choiceName {
        ADD_A_SERVER = "ADD",
        RUN_A_SERVER = "RUN",
        FABRIC = "FABRIC",
        VANILLA = "VANILLA",
        EXIT = "EXIT",
        ENTRY = "ENTRY"
    }
}

export namespace DBManagerType {
    export interface ServerInfo {
        server_name: string;
        dir: string;
        target: string;
    }
}
