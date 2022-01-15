import {PatternType} from "./interface";

export const pattern: PatternType.PatternMap = {
    TEST_RUN_SUCCESS: /EULA/,
    SERVER_START_DONE: /Done/
}

export enum eventNameEnum {
    SAVE_OFF_DONE = "save-off-done",
    SAVE_ALL_DONE = "save-all-done",
    JOINT_PLAYER = "joint-player",
    SERVER_CLOSE = "server-close"
}

export const serverStatusPattern = [
    {
        rule: /Automatic saving is now disabled/,
        event: eventNameEnum.SAVE_OFF_DONE
    },
    {
        rule: /Saved the game/,
        event: eventNameEnum.SAVE_ALL_DONE
    },
    {
        rule: /joined the game/,
        event: eventNameEnum.JOINT_PLAYER
    },
    {
        rule: /Program will exit/,
        event: eventNameEnum.SERVER_CLOSE
    }
]

